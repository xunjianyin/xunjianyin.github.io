*<span style="color:gray;">This blog is based on the paper <a href="https://arxiv.org/abs/2410.04444">Gödel Agent: A Self-Referential Agent Framework for Recursively Self-Improvement</a>.</span>*

In the race to build truly intelligent AI agents, we've made incredible progress. We have agents that can write code, reason through complex problems, and interact with digital environments in sophisticated ways. But have we been building them on the right foundation? I believe we've been operating under a set of assumptions that, while powerful, will ultimately limit our progress. We've been trapped in an "Optimizer's Dilemma," and the only way out is to embrace a principle that is fundamental to our own intelligence: self-reference.

### **The Two Paradigms and Their Hidden Ceiling**

Today, nearly every agent falls into one of two camps.

The first is the **Hand-Designed Agent**. Here, we humans act as the architects, meticulously designing the agent's workflow. We tell it to use Chain-of-Thought, or follow a ReAct loop, or some other clever process we’ve conceived. It's like giving the agent a detailed recipe. The problem? These recipes are brittle. They are often overfitted to the specific foundation model they were designed for, and more importantly, they represent just a few, intuition-driven points in a staggeringly vast design space. We have no way of knowing if our recipe is even close to the best one.

Recognizing this limitation, we developed the second camp: the **Meta-Learning Optimized Agent**. This is a clever leap forward. Instead of designing the agent's workflow, we design an *algorithm* to *search* for the best workflow. We turn agent design into an optimization problem, using techniques like MCTS or meta-agents to explore the design space for us.

But this just pushes the problem up one level. The agent's performance is no longer capped by our hand-designed workflow, but by our hand-designed *optimizer*. The optimizer itself is a product of human priors and limitations.

This leads to a logical paradox—an infinite regress. If our optimizer is sub-optimal, how do we improve it? Do we design a meta-meta-optimizer? And a meta-meta-meta-optimizer for that one? It's a stack of Russian dolls that never ends. This cannot be the path to general intelligence.

### **The Human Blueprint: We Are Our Own Optimizers**

To break this cycle, we need a better inspiration. Look at us. Humans don't have a fixed, external algorithm guiding our self-improvement. We possess subjective agency. We reflect on feedback, identify flaws in our own thinking, and actively *change our own cognitive strategies*. A student who struggles with algebra doesn't just try the same failed method faster; they learn a new way to think about the problem. They rewrite their own mental software.

This is the essence of true self-improvement. It's not about refining a solution you've already produced. It's not about using a fixed algorithm to tune a small part of yourself. **True self-improvement is the ability to modify the very logic that governs your own operation.**

### **The Gödel Agent: An Agent That Can Rewrite Itself**

This is the core idea behind the Gödel Agent framework. What if we built an agent whose primary capability was to read and modify its own source code while it was running?

The technical challenge is fascinating. How can a program modify a function that is currently executing? Our solution was to structure the agent's life not as a traditional loop (while True:), but as a **recursive function**.

In each step (each recursive call), the agent can analyze its performance and decide to rewrite any part of its code, including the main recursive function itself. That change doesn't affect the current step, but when the function calls itself to begin the next moment of its existence, the new, improved version of the code is loaded. It’s an elegant way to enable a program to evolve its core logic over time.

### **The Virtuous Cycle of Self-Improvement**

This self-referential capability unlocks a powerful virtuous cycle.

1. An agent that improves its problem-solving logic becomes more effective.  
2. By becoming more effective, it gets better at the meta-task of *analyzing and improving its own code*.  
3. A better self-optimizer can then find even more profound improvements.

This creates the potential for a new kind of scaling law—an exponential curve where the better an agent gets, the faster it can get better.

This approach is also inherently future-proof. Unlike hand-designed workflows that are tied to a specific LLM, a self-referential agent's performance simply scales with the underlying model's ability to reason about and write code. As models improve, the agent naturally becomes a more effective self-optimizer.

### **The Unbounded Future**

By removing the constraints of a human-designed workflow or a human-designed optimizer, we grant the agent access to an unbounded search space. It could, in theory, discover any framework humans have already built, and more excitingly, discover novel architectures we haven't even imagined.

Of course, this power demands a profound sense of responsibility and a serious focus on safety. But it also points toward a new direction for AI—one that relies less on imposing our own rigid structures and more on creating the conditions for intelligence to emerge and improve on its own.

We are self-referential. It is the engine of our own progress. To build AGI, perhaps it's time we build our agents in our own image.