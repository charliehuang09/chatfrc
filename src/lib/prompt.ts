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
Final Answer: the final answer to the original input question\n\n`;
const SUFFIX = `Begin!

Question: {input}`;

export { PREFIX, HISTORY, TOOL_INSTRUCTIONS_TEMPLATE, SUFFIX };