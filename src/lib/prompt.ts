const SYSTEM = `Answer the following questions in detail as best you can. You have access to the following tools:\n {tools}
Use the following format in your response:
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question. The user only sees the Final Answer so put all the information in the Final Answer\n\n`;
const PREFIX = `Answer the following questions as best you can. You have access to the following tools:
`;
const HISTORY = `Here is the chat history: \n`;
const TOOL_INSTRUCTIONS_TEMPLATE = `Use the following format in your response.:
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question. The user only sees the Final Answer\n\n`;
const SUFFIX = `Begin!

Question: {input}\n`;
const SUMMARY = `Please answer the following question with following the context
<question> {question} <question>
<context> {text} <context>
Response: `;

export { SYSTEM, PREFIX, HISTORY, TOOL_INSTRUCTIONS_TEMPLATE, SUFFIX, SUMMARY };