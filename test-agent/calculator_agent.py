"""Calculator agent — solves multi-step math problems with arithmetic and unit conversion."""

from __future__ import annotations

import ast
import math
import operator as op

from langchain_core.prompts import PromptTemplate
from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langchain_classic.agents import AgentExecutor, create_react_agent

from trace_client import ElioTracer

OLLAMA_BASE = "http://localhost:11434"
MODEL = "gemma3:12b"

# ---------------------------------------------------------------------------
# Safe expression evaluator
# ---------------------------------------------------------------------------

_OPS: dict = {
    ast.Add: op.add,
    ast.Sub: op.sub,
    ast.Mult: op.mul,
    ast.Div: op.truediv,
    ast.Pow: op.pow,
    ast.Mod: op.mod,
    ast.FloorDiv: op.floordiv,
    ast.USub: op.neg,
    ast.UAdd: op.pos,
}

_MATH_FUNCS = {
    name: getattr(math, name)
    for name in ("sqrt", "ceil", "floor", "log", "log10", "sin", "cos", "tan", "pi", "e")
}


def _eval_node(node: ast.expr) -> float:
    if isinstance(node, ast.Constant):
        return float(node.n)
    if isinstance(node, ast.Name) and node.id in _MATH_FUNCS:
        return float(_MATH_FUNCS[node.id])
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval_node(node.left), _eval_node(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval_node(node.operand))
    if isinstance(node, ast.Call):
        func_name = node.func.id if isinstance(node.func, ast.Name) else ""
        if func_name in _MATH_FUNCS:
            args = [_eval_node(a) for a in node.args]
            return float(_MATH_FUNCS[func_name](*args))
    raise ValueError(f"Unsupported expression: {ast.dump(node)}")


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@tool
def calculate(expression: str) -> str:
    """
    Evaluate a mathematical expression and return the numeric result.
    Supports: +, -, *, /, **, %, //, and math functions like sqrt(), sin(), log().
    Examples: "2 ** 10", "sqrt(144)", "100 * 1.609344"
    """
    try:
        tree = ast.parse(expression.strip(), mode="eval")
        result = _eval_node(tree.body)
        # Format: integer if it's a whole number, otherwise up to 6 significant figures
        if result == int(result) and abs(result) < 1e15:
            return str(int(result))
        return f"{result:.6g}"
    except Exception as exc:
        return f"Error evaluating '{expression}': {exc}"


_UNIT_TABLE: dict[str, dict[str, float]] = {
    # Length (base: meters)
    "m": {"km": 0.001, "cm": 100, "mm": 1000, "ft": 3.28084, "in": 39.3701, "mi": 0.000621371, "yd": 1.09361},
    "km": {"m": 1000, "mi": 0.621371, "ft": 3280.84},
    "mi": {"km": 1.60934, "m": 1609.34, "ft": 5280},
    "ft": {"m": 0.3048, "in": 12, "yd": 1 / 3, "mi": 1 / 5280},
    "in": {"cm": 2.54, "ft": 1 / 12},
    # Weight (base: kg)
    "kg": {"g": 1000, "lb": 2.20462, "oz": 35.274},
    "g": {"kg": 0.001, "lb": 0.00220462, "oz": 0.035274},
    "lb": {"kg": 0.453592, "g": 453.592, "oz": 16},
    "oz": {"g": 28.3495, "lb": 0.0625},
    # Speed
    "mph": {"kph": 1.60934, "mps": 0.44704},
    "kph": {"mph": 0.621371, "mps": 0.277778},
    "mps": {"mph": 2.23694, "kph": 3.6},
    # Area
    "sqm": {"sqft": 10.7639, "sqkm": 1e-6},
    "sqft": {"sqm": 0.092903},
    # Volume
    "l": {"ml": 1000, "gal": 0.264172, "fl_oz": 33.814},
    "ml": {"l": 0.001, "tsp": 0.202884, "tbsp": 0.067628},
    "gal": {"l": 3.78541, "qt": 4, "pt": 8},
}


@tool
def convert_units(query: str) -> str:
    """
    Convert a numeric value from one unit to another.
    Input format: 'value, from_unit, to_unit'
    Supported units: m, km, mi, ft, in, kg, g, lb, oz, mph, kph, mps, l, ml, gal.
    Special case: temperature with from_unit/to_unit as 'C', 'F', or 'K'.
    Example: '60, mph, kph' → "96.5604 kph"
    """
    try:
        parts = [p.strip().strip('"').strip("'") for p in query.split(',')]
        if len(parts) != 3:
            return f"Error: expected 'value, from_unit, to_unit', got: {query!r}"
        value, from_unit, to_unit = float(parts[0]), parts[1], parts[2]
    except (ValueError, TypeError) as exc:
        return f"Error parsing convert_units input {query!r}: {exc}"
    f, t = from_unit.strip().lower(), to_unit.strip().lower()

    # Temperature special case
    temp_units = {"c", "f", "k", "celsius", "fahrenheit", "kelvin"}
    if f in temp_units and t in temp_units:
        f = f[0]
        t = t[0]
        # Convert to Celsius first
        if f == "f":
            c = (value - 32) * 5 / 9
        elif f == "k":
            c = value - 273.15
        else:
            c = value
        # Convert from Celsius
        if t == "f":
            result = c * 9 / 5 + 32
        elif t == "k":
            result = c + 273.15
        else:
            result = c
        return f"{result:.4g} {to_unit}"

    if f == t:
        return f"{value} {to_unit}"

    table = _UNIT_TABLE.get(f, {})
    if t in table:
        result = value * table[t]
        return f"{result:.6g} {to_unit}"

    # Try reverse lookup
    rev_table = _UNIT_TABLE.get(t, {})
    if f in rev_table:
        result = value / rev_table[f]
        return f"{result:.6g} {to_unit}"

    return f"Cannot convert from '{from_unit}' to '{to_unit}' — unsupported unit pair."


# ---------------------------------------------------------------------------
# Agent setup
# ---------------------------------------------------------------------------

llm = ChatOllama(model=MODEL, base_url=OLLAMA_BASE, temperature=0)

tools = [calculate, convert_units]

prompt = PromptTemplate.from_template(
    "You are a precise math assistant. Break complex problems into steps, "
    "use the calculate tool for arithmetic and the convert_units tool for unit conversions. "
    "Show your reasoning before giving the final answer.\n\n"
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
    max_iterations=8,
    handle_parsing_errors=True,
)

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    problem = (
        "A car travels at 75 mph for 2.5 hours. "
        "What is the total distance in kilometers? "
        "Also, if fuel costs $3.80 per gallon and the car gets 32 mpg, "
        "how much did the fuel cost for the trip?"
    )
    print(f"\nProblem: {problem}\n{'─' * 60}")

    tracer = ElioTracer(run_name="Calculator Agent")
    result = agent_executor.invoke(
        {"input": problem},
        config={"callbacks": [tracer]},
    )
    print(f"\n{'─' * 60}\nAnswer: {result['output']}")
