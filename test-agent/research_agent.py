"""Research agent — uses a mock web search tool to answer questions."""

from __future__ import annotations

from langchain_core.prompts import PromptTemplate
from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langchain_classic.agents import AgentExecutor, create_react_agent

from trace_client import ElioTracer

OLLAMA_BASE = "http://localhost:11434"
MODEL = "gemma3:12b"

# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

_MOCK_RESULTS: dict[str, str] = {
    "quantum computing": (
        "Quantum computing in 2024–2025: Google's Willow chip achieved 105 qubits with "
        "below-threshold error correction. IBM's Heron processor reached 133 qubits. "
        "Microsoft announced topological qubits. Key applications: cryptography, "
        "drug discovery, optimization problems."
    ),
    "large language models": (
        "LLM advances: GPT-4o, Claude 3.5, Gemini 1.5 Pro lead benchmarks. "
        "Key trends: longer context windows (up to 2M tokens), multimodal input/output, "
        "agentic capabilities, smaller but efficient models (Llama 3, Mistral)."
    ),
    "renewable energy": (
        "Solar panel efficiency records broken in 2024: 29.4% for perovskite-silicon tandem. "
        "Global solar capacity exceeded 2 TW. Wind power output up 15% YoY. "
        "Battery storage costs dropped below $100/kWh for grid-scale installations."
    ),
}


@tool
def search_web(query: str) -> str:
    """Search the web for current information about a topic. Returns a summary of results."""
    query_lower = query.lower()
    for keyword, result in _MOCK_RESULTS.items():
        if keyword in query_lower:
            return result
    return (
        f"Search results for '{query}': Multiple sources found. "
        "The topic has seen significant developments recently, with researchers publishing "
        "new findings across academic and industry settings. Key themes include efficiency "
        "improvements, cost reductions, and expanded real-world applications."
    )


# ---------------------------------------------------------------------------
# Agent setup
# ---------------------------------------------------------------------------

llm = ChatOllama(model=MODEL, base_url=OLLAMA_BASE, temperature=0)

tools = [search_web]

prompt = PromptTemplate.from_template(
    "You are a thorough research assistant. Use the search_web tool to find information, "
    "then synthesize a clear and accurate answer citing key facts.\n\n"
    "You have access to the following tools:\n\n"
    "{tools}\n\n"
    "Use the following format:\n\n"
    "Question: the input question you must answer\n"
    "Thought: you should always think about what to do\n"
    "Action: the action to take, should be one of [{tool_names}]\n"
    "Action Input: the input to the action\n"
    "Observation: the result of the action\n"
    "... (this Thought/Action/Action Input/Observation can repeat N times)\n"
    "Thought: I now know the final answer\n"
    "Final Answer: the final answer to the original input question\n\n"
    "Begin!\n\n"
    "Question: {input}\n"
    "Thought:{agent_scratchpad}"
)

agent = create_react_agent(llm, tools, prompt)

agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    max_iterations=5,
    handle_parsing_errors=True,
)

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    question = "What are the latest advances in quantum computing?"
    print(f"\nQuestion: {question}\n{'─' * 60}")

    tracer = ElioTracer(run_name="Research Agent")
    result = agent_executor.invoke(
        {"input": question},
        config={"callbacks": [tracer]},
    )
    print(f"\n{'─' * 60}\nAnswer: {result['output']}")
