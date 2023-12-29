import { Document } from 'langchain/document';

import { ChatOpenAI } from 'langchain/chat_models/openai';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { type AgentAction, type AgentFinish, SystemMessage, BaseMessage, AIMessage, HumanMessage, type InputValues, type AgentStep} from 'langchain/schema';

import { ChatHistoryType, type ChatHistory } from '$lib/history';
import { BytesOutputParser } from 'langchain/schema/output_parser';

import { QdrantClient } from '@qdrant/js-client-rest';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { SerpAPI } from 'langchain/tools';
import { Calculator } from 'langchain/tools/calculator';
import { formatLogToString } from "langchain/agents/format_scratchpad/log";
import { RunnableSequence } from "langchain/schema/runnable";
import { PromptTemplate } from "langchain/prompts";
import { AgentExecutor } from "langchain/agents";

const DEFAULT_MODEL = 'gpt-3.5-turbo';
const DEFAULT_COLLECTION = 'default';

export class ChatbotCompletion {
	private model: ChatOpenAI;
	private embeddings_model: OpenAIEmbeddings;

	private qdrant_client: QdrantClient;
	private qdrant_collection: string;
	private tools: any;
	private executor: any;

	constructor(
		openai_api_key: string,
		{
			openai_model = DEFAULT_MODEL,
			qdrant_collection = DEFAULT_COLLECTION
		}: {
			openai_model?: string;
			qdrant_collection?: string;
		}
	) {
		this.model = new ChatOpenAI({
			openAIApiKey: openai_api_key,
			temperature: 0.7,
			streaming: true,
			maxTokens: 250,
			modelName: openai_model,
			verbose: false
		});

		this.embeddings_model = new OpenAIEmbeddings({
			openAIApiKey: openai_api_key,
			modelName: 'text-embedding-ada-002'
		});
		this.qdrant_client = new QdrantClient({
			url: 'http://' + (process.env.QDRANT_HOST ?? 'localhost') + ':6333'
		});

		this.tools = [
			new SerpAPI(process.env.SERPAPI_API_KEY, {
			  location: "Austin,Texas,United States",
			  hl: "en",
			  gl: "us",
			}),
			new Calculator(),
		  ];

		this.qdrant_collection = qdrant_collection;
	}

	public async generate_executor(){
		this.executor = await initializeAgentExecutorWithOptions(this.tools, this.model, {
			agentType: 'zero-shot-react-description',
			verbose: false
		});
	}

	public async formatMessages(values: InputValues): Promise<Array<BaseMessage>> {
		//From https://js.langchain.com/docs/modules/agents/how_to/custom_llm_agent
		const PREFIX = `Answer the following questions as best you can. You have access to the following tools: {tools}`;
		const TOOL_INSTRUCTIONS_TEMPLATE = `Use the following format in your response:
		Question: the input question you must answer
		Thought: you should always think about what to do
		Action: the action to take, should be one of [{tool_names}]
		Action Input: the input to the action
		Observation: the result of the action
		... (this Thought/Action/Action Input/Observation can repeat N times)
		Thought: I now know the final answer
		Final Answer: the final answer to the original input question`;
		const SUFFIX = `Begin!
		Question: {input}
		Thought:`;
		console.log('checkpoint')
		if (!("input" in values) || !("intermediate_steps" in values)) {
			throw new Error("Missing input or agent_scratchpad from values.");
		  }
		  /** Extract and case the intermediateSteps from values as Array<AgentStep> or an empty array if none are passed */
		  const intermediateSteps = values.intermediate_steps
			? (values.intermediate_steps as Array<AgentStep>)
			: [];
		  /** Call the helper `formatLogToString` which returns the steps as a string  */
		  const agentScratchpad = formatLogToString(intermediateSteps);
		  /** Construct the tool strings */
		  const toolStrings = this.tools
			.map((tool: any) => `${tool.name}: ${tool.description}`)
			.join("\n");
		  const toolNames = this.tools.map((tool: any) => tool.name).join(",\n");
		  /** Create templates and format the instructions and suffix prompts */
		  const prefixTemplate = new PromptTemplate({
			template: PREFIX,
			inputVariables: ["tools"],
		  });
		  const instructionsTemplate = new PromptTemplate({
			template: TOOL_INSTRUCTIONS_TEMPLATE,
			inputVariables: ["tool_names"],
		  });
		  const suffixTemplate = new PromptTemplate({
			template: SUFFIX,
			inputVariables: ["input"],
		  });
		  /** Format both templates by passing in the input variables */
		  const formattedPrefix = await prefixTemplate.format({
			tools: toolStrings,
		  });
		  const formattedInstructions = await instructionsTemplate.format({
			tool_names: toolNames,
		  });
		  const formattedSuffix = await suffixTemplate.format({
			input: values.input,
		  });
		  /** Construct the final prompt string */
		  const formatted = [
			formattedPrefix,
			formattedInstructions,
			formattedSuffix,
			agentScratchpad,
		  ].join("\n");
		  /** Return the message as a HumanMessage. */
		  return [new HumanMessage(formatted)];
	}
	private customOutputParser(text: string): AgentAction | AgentFinish {
		//From https://js.langchain.com/docs/modules/agents/how_to/custom_llm_agent
		/** If the input includes "Final Answer" return as an instance of `AgentFinish` */
		if (text.includes("Final Answer:")) {
		  const parts = text.split("Final Answer:");
		  const input = parts[parts.length - 1].trim();
		  const finalAnswers = { output: input };
		  return { log: text, returnValues: finalAnswers };
		}
		/** Use regex to extract any actions and their values */
		const match = /Action: (.*)\nAction Input: (.*)/s.exec(text);
		if (!match) {
		  throw new Error(`Could not parse LLM output: ${text}`);
		}
		/** Return as an instance of `AgentAction` */
		return {
		  tool: match[1].trim(),
		  toolInput: match[2].trim().replace(/^"+|"+$/g, ""),
		  log: text,
		};
	  }
	

	/*
        We need to pass with_vector to qdrant to get our response
    */
	private async qdrant_similarity_search(query: string, k: number): Promise<Document[]> {
		const query_embedding = await this.embeddings_model.embedQuery(query);
		const qdrant_results = await this.qdrant_client.search(this.qdrant_collection, {
			vector: query_embedding,
			limit: k,
			with_vector: true
		});

		// console.log(qdrant_results);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return qdrant_results.map((result: any) => {
			return new Document({
				pageContent: result.payload.pageContent,
				metadata: result.payload.metadata
			});
		});
	}

	private async get_vector_response(query: string): Promise<string[]> {
		console.log('Retrieving vector response from qdrant...');

		const vector_response = await this.qdrant_similarity_search(query, 2);

		// console.log(vector_response);

		console.log('Vector response retreived');

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return vector_response.map((document: Document<Record<string, any>>) => {
			return document.pageContent;
		});
	}

	private generate_history(history: ChatHistory[]): BaseMessage[] {
		return history.map((message: { content: string; type: ChatHistoryType }) => {
			if (message.type == ChatHistoryType.AI) {
				return new AIMessage({ content: message.content });
			} else {
				return new HumanMessage({ content: message.content });
			}
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async query(history: ChatHistory[], input: any): Promise<any> {
		const runnable = RunnableSequence.from([
		{
			input: (values: InputValues) => values.input,
			intermediate_steps: (values: InputValues) => values.steps,
		},
		this.formatMessages,
		this.model,
		this.customOutputParser,
		]);
		const ex = new AgentExecutor({
		agent: runnable,
		tools: this.tools,
		});

		const tmp = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

		console.log(`Executing with input "${tmp}"...`);

		const res = await ex.invoke({ tmp });

		console.log(`Got output ${res.output}`);


		const result = await this.executor.invoke({ input });
		return result;
	}
}
