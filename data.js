// Unified Publications Data
const publications = [
  // Preprints
  {
    title: "From Atomic to Composite: Reinforcement Learning Enables Generalization in Complementary Reasoning",
    authors: "Sitao Cheng, <b>Xunjian Yin</b>, Ruiwen Zhou, Yuxuan Li, Xinyi Wang, Liangming Pan, William Yang Wang, Victor Zhong",
    venue: "ArXiv:2510",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2512.01970" },
      { text: "Code", url: "https://github.com/sitaocheng/from_atomic_to_composite" },
      { text: "Page", url: "papers/atomic-to-composite.html" }
    ],
    abstract: "The mechanism by which RL contributes to reasoning capabilities-whether it incentivizes the synthesis of new skills or merely amplifies existing behaviors-remains a subject of intense debate. In this work, we investigate this question through the lens of Complementary Reasoning, a complex task that requires integrating internal parametric knowledge with external contextual information. Using a controlled synthetic dataset of human biographies, we strictly decouple this ability into two atomic skills: Parametric Reasoning (relying on internal knowledge) and Contextual Reasoning (depending on external information). To rigorously assess capability boundaries, we evaluate generalization across three distinct levels of difficulty: I.I.D., Composition, and Zero-shot settings. We find that while SFT is sufficient for in-distribution performance, it struggles with O.O.D. generalization, particularly in Zero-shot settings where relational combinations are novel. Crucially, we identify the SFT Generalization Paradox: Models supervised solely on the composite task achieve near-perfect in-distribution accuracy but collapse on out-of-distribution generalization, indicating their reliance on rote memorization of path shortcuts. In contrast, we find that RL acts as a reasoning synthesizer rather than a probability amplifier. However, we uncover a strict atomic prerequisite: RL can only synthesize these complex strategies if the base model has first mastered the independent atomic skills (Parametric and Contextual) via SFT. These findings challenge the view of RL as a mere amplifier, suggesting that given sufficient atomic foundations, RL can actively synthesize complex reasoning strategies from learned primitives without explicit supervision on such complex strategies. This indicates that decoupled atomic training followed by RL offers a scalable path to generalization for complex reasoning tasks.",
    citation: `<pre><code>@misc{cheng2025atomiccompositereinforcementlearning,
      title={From Atomic to Composite: Reinforcement Learning Enables Generalization in Complementary Reasoning}, 
      author={Sitao Cheng and Xunjian Yin and Ruiwen Zhou and Yuxuan Li and Xinyi Wang and Liangming Pan and William Yang Wang and Victor Zhong},
      year={2025},
      eprint={2512.01970},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2512.01970}, 
}</code></pre>`,
    isPreprint: true,
    isSelected: true
  },
  {
    title: "Differentiable Evolutionary Reinforcement Learning",
    authors: "Sitao Cheng*, Tianle Li*, Xuhan Huang*, <b>Xunjian Yin</b>, Difan Zou",
    venue: "ArXiv:2510",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2512.13399" },
      { text: "Code", url: "https://github.com/sitaocheng/DERL" },
      { text: "Page", url: "papers/derl.html" }
    ],
    abstract: "The design of effective reward functions presents a central and often arduous challenge in reinforcement learning (RL), particularly when developing autonomous agents for complex reasoning tasks. While automated reward optimization approaches exist, they typically rely on derivative-free evolutionary heuristics that treat the reward function as a black box, failing to capture the causal relationship between reward structure and task performance. To bridge this gap, we propose Differentiable Evolutionary Reinforcement Learning (DERL), a bilevel framework that enables the autonomous discovery of optimal reward signals. In DERL, a Meta-Optimizer evolves a reward function (i.e., Meta-Reward) by composing structured atomic primitives, guiding the training of an inner-loop policy. Crucially, unlike previous evolution, DERL is differentiable in its metaoptimization: it treats the inner-loop validation performance as a signal to update the Meta-Optimizer via reinforcement learning. This allows DERL to approximate the meta-gradient of task success, progressively learning to generate denser and more actionable feedback. We validate DERL across three distinct domains: robotic agent (ALFWorld), scientific simulation (ScienceWorld), and mathematical reasoning (GSM8k, MATH). Experimental results show that DERL achieves state-of-the-art performance on ALFWorld and ScienceWorld, significantly outperforming methods relying on heuristic rewards, especially in out-of-distribution scenarios. Analysis of the evolutionary trajectory demonstrates that DERL successfully captures the intrinsic structure of tasks, enabling selfimproving agent alignment without human intervention.",
    citation: `<pre><code>@misc{cheng2025differentiableevolutionaryreinforcementlearning,
      title={Differentiable Evolutionary Reinforcement Learning}, 
      author={Sitao Cheng and Tianle Li and Xuhan Huang and Xunjian Yin and Difan Zou},
      year={2025},
      eprint={2512.13399},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2512.13399}, 
}</code></pre>`,
    isPreprint: true,
    isSelected: false
  },
  {
    title: "The Geometry of Reasoning: Flowing Logics in Representation Space",
    authors: "Yufa Zhou*, Yixiao Wang*, <b>Xunjian Yin*</b>, Shuyan Zhou, Anru R. Zhang",
    venue: "ICLR 2026",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2510.09782" },
      { text: "Code", url: "https://github.com/MasterZhou1/Reasoning-Flow" },
      { text: "Page", url: "papers/geometry-of-reasoning.html" }
    ],
    abstract: "We study how large language models (LLMs) ``think'' through their representation space. We propose a novel geometric framework that models an LLM's reasoning as flows -- embedding trajectories evolving where logic goes. We disentangle logical structure from semantics by employing the same natural deduction propositions with varied semantic carriers, allowing us to test whether LLMs internalize logic beyond surface form. This perspective connects reasoning with geometric quantities such as position, velocity, and curvature, enabling formal analysis in representation and concept spaces. Our theory establishes: (1) LLM reasoning corresponds to smooth flows in representation space, and (2) logical statements act as local controllers of these flows' velocities. Using learned representation proxies, we design controlled experiments to visualize and quantify reasoning flows, providing empirical validation of our theoretical framework. Our work serves as both a conceptual foundation and practical tools for studying reasoning phenomenon, offering a new lens for interpretability and formal analysis of LLMs' behavior.",
    citation: `<pre><code>@misc{zhou2025geometryreasoningflowinglogics,
      title={The Geometry of Reasoning: Flowing Logics in Representation Space}, 
      author={Yufa Zhou and Yixiao Wang and Xunjian Yin and Shuyan Zhou and Anru R. Zhang},
      year={2025},
      eprint={2510.09782},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2510.09782},
}</code></pre>`,
    isNew: true,
    isPreprint: false,
    isSelected: true
  },
  {
    title: "Reverse Language Model",
    authors: "<b>Xunjian Yin</b>, Sitao Cheng, Yuxi Xie, Xinyu Hu, Li Lin, Xinyi Wang, Liangming Pan, William Yang Wang, Xiaojun Wan",
    venue: "ArXiv:2507",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2507.01335" },
      { text: "Model", url: "https://huggingface.co/Corning/Reverse-Model-7B-348B" },
      { text: "Page", url: "papers/reverse-lm.html" }
    ],
    abstract: "We introduce LEDOM, the first purely reverse language model, trained autoregressively on 435B tokens with 2B and 7B parameter variants, which processes sequences in reverse temporal order through previous token prediction. For the first time, we present the reverse language model as a potential foundational model across general tasks, accompanied by a set of intriguing examples and insights. Based on LEDOM, we further introduce a novel application: Reverse Reward, where LEDOM-guided reranking of forward language model outputs leads to substantial performance improvements on mathematical reasoning tasks. This approach leverages LEDOM's unique backward reasoning capability to refine generation quality through posterior evaluation. Our findings suggest that LEDOM exhibits unique characteristics with broad application potential. We will release all models, training code, and pre-training data to facilitate future research.",
    citation: `<pre><code>@misc{yin2025ledomopenfundamentalreverse,
      title={LEDOM: An Open and Fundamental Reverse Language Model}, 
      author={Xunjian Yin and Sitao Cheng and Yuxi Xie and Xinyu Hu and Li Lin and Xinyi Wang and Liangming Pan and William Yang Wang and Xiaojun Wan},
      year={2025},
      eprint={2507.01335},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2507.01335}, 
}</code></pre>`,
    isPreprint: true,
    isSelected: true
  },
  {
    title: "COrAL: Order-Agnostic Language Modeling for Efficient Iterative Refinement",
    authors: "Yuxi Xie, Anirudh Goyal, Xiaobao Wu, <b>Xunjian Yin</b>, Xiao Xu, Min-Yen Kan, Liangming Pan, William Yang Wang",
    venue: "ArXiv:2410",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2410.09675" },
      { text: "Code", url: "https://github.com/YuxiXie/COrAL" },
      { text: "Page", url: "papers/coral.html" }
    ],
    abstract: "Iterative refinement has emerged as an effective paradigm for enhancing the capabilities of large language models (LLMs) on complex tasks. However, existing approaches typically implement iterative refinement at the application or prompting level, relying on autoregressive (AR) modeling. The sequential token generation in AR models can lead to high inference latency. To overcome these challenges, we propose Context-Wise Order-Agnostic Language Modeling (COrAL), which incorporates iterative refinement directly into the LLM architecture while maintaining computational efficiency. Our approach models multiple token dependencies within manageable context windows, enabling the model to perform iterative refinement internally during the generation process. Leveraging the order-agnostic nature of COrAL, we introduce sliding blockwise order-agnostic decoding, which performs multi-token forward prediction and backward reconstruction within context windows. This allows the model to iteratively refine its outputs in parallel in the sliding block, effectively capturing diverse dependencies without the high inference cost of sequential generation. Empirical evaluations on reasoning tasks demonstrate that COrAL improves performance and inference speed, respectively, achieving absolute accuracy gains of $4.6\\%$ on GSM8K and $4.0\\%$ on LogiQA, along with inference speedups of up to $3.9\\times$ over next-token baselines. Preliminary results on code generation indicate a drop in pass rates due to inconsistencies in order-agnostic outputs, highlighting the inherent quality--speed trade-off. Our code is publicly available at https://github.com/YuxiXie/COrAL.",
    citation: `<pre><code>@misc{xie2024coralorderagnosticlanguagemodeling,
      title={COrAL: Order-Agnostic Language Modeling for Efficient Iterative Refinement}, 
      author={Yuxi Xie and Anirudh Goyal and Xiaobao Wu and Xunjian Yin and Xiao Xu and Min-Yen Kan and Liangming Pan and William Yang Wang},
      year={2024},
      eprint={2410.09675},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2410.09675}, 
}</code></pre>`,
    isPreprint: true,
    isSelected: false
  },
  {
    title: "ContraSolver: Self-Alignment of Language Models by Resolving Internal Preference Contradictions",
    authors: "Xu Zhang*, <b>Xunjian Yin</b>*, Xiaojun Wan",
    venue: "ArXiv:2406",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2406.08842" },
      { text: "Code", url: "https://github.com/Arvid-pku/ContraSolver" },
      { text: "Page", url: "papers/contrasolver.html" }
    ],
    abstract: "While substantial advancements have been made in developing large language models (LLMs), achieving control over their behavior can be difficult. Direct preference optimization (DPO) assumes the existence of a latent reward function to evaluate the responses of LLMs. This assumption indicates a strict preference ordering of different responses to the same input. However, there always exist contradictions of preference in LLMs according to our experimental observations. In this paper, we construct a graph structure of the preference relationship among different responses with self-annotation to find contradictions in the preference order. We propose ContraSolver, an algorithm that traverses all edges on the preference graph to identify those that might cause contradictions. ContraSolver initializes the graph with a maximum spanning tree and identifies contradictory edges, prioritizing the resolution of low-confidence preferences while preserving high-confidence ones. Experimental results on four different generation tasks show that the performance of different LLMs can be largely improved through our completely unsupervised self-alignment. Furthermore, by analyzing the preference graphs of LLMs with and without self-alignment by ContraSolver, we quantify the reduction in contradictions, suggesting that resolving preference contradictions is crucial for achieving better alignment performance.",
    citation: `<pre><code>@misc{zhang2024contrasolverselfalignmentlanguagemodels,
      title={ContraSolver: Self-Alignment of Language Models by Resolving Internal Preference Contradictions}, 
      author={Xu Zhang and Xunjian Yin and Xiaojun Wan},
      year={2024},
      eprint={2406.08842},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2406.08842}, 
}</code></pre>`,
    isPreprint: true,
    isSelected: true
  },
  // Publications
  {
    title: "DAMON: A Dialogue-Aware MCTS Framework for Jailbreaking Large Language Models",
    authors: "Xu Zhang, <b>Xunjian Yin</b>, Dinghao Jing, Huixuan Zhang, Xinyu Hu, Xiaojun Wan",
    venue: "EMNLP 2025",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2025.emnlp-main.323/" },
      { text: "Code", url: "https://github.com/pkulcwmzx/DAMON" },
      { text: "Page", url: "papers/damon.html" }
    ],
    abstract: "While large language models (LLMs) demonstrate remarkable capabilities across a wide range of tasks, they remain vulnerable to generating outputs that are potentially harmful. Red teaming, which involves crafting adversarial inputs to expose vulnerabilities, is a widely adopted approach for evaluating the robustness of these models. Prior studies have indicated that LLMs are susceptible to vulnerabilities exposed through multi-turn interactions as opposed to single-turn scenarios. Nevertheless, existing methods for multi-turn attacks mainly utilize a predefined dialogue pattern, limiting their effectiveness in realistic situations. Effective attacks require adaptive dialogue strategies that respond dynamically to the initial user prompt and the evolving context of the conversation. To address these limitations, we propose DAMON, a novel multi-turn jailbreak attack method. DAMON leverages Monte Carlo Tree Search (MCTS) to systematically explore multi-turn conversational spaces, efficiently identifying sub-instruction sequences that induce harmful responses. We evaluate DAMON's efficacy across five LLMs and three datasets. Our experimental results show that DAMON can effectively induce undesired behaviors.",
    citation: `<pre><code>@inproceedings{zhang-etal-2025-damon,
    title = "{DAMON}: A Dialogue-Aware {MCTS} Framework for Jailbreaking Large Language Models",
    author = "Zhang, Xu  and
      Yin, Xunjian  and
      Jing, Dinghao  and
      Zhang, Huixuan  and
      Hu, Xinyu  and
      Wan, Xiaojun",
    editor = "Christodoulopoulos, Christos  and
      Chakraborty, Tanmoy  and
      Rose, Carolyn  and
      Peng, Violet",
    booktitle = "Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing",
    month = nov,
    year = "2025",
    address = "Suzhou, China",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2025.emnlp-main.323/",
    doi = "10.18653/v1/2025.emnlp-main.323",
    pages = "6361--6377",
    ISBN = "979-8-89176-332-6",
    abstract = "While large language models (LLMs) demonstrate remarkable capabilities across a wide range of tasks, they remain vulnerable to generating outputs that are potentially harmful. Red teaming, which involves crafting adversarial inputs to expose vulnerabilities, is a widely adopted approach for evaluating the robustness of these models. Prior studies have indicated that LLMs are susceptible to vulnerabilities exposed through multi-turn interactions as opposed to single-turn scenarios. Nevertheless, existing methods for multi-turn attacks mainly utilize a predefined dialogue pattern, limiting their effectiveness in realistic situations. Effective attacks require adaptive dialogue strategies that respond dynamically to the initial user prompt and the evolving context of the conversation. To address these limitations, we propose DAMON, a novel multi-turn jailbreak attack method. DAMON leverages Monte Carlo Tree Search (MCTS) to systematically explore multi-turn conversational spaces, efficiently identifying sub-instruction sequences that induce harmful responses. We evaluate DAMON{'}s efficacy across five LLMs and three datasets. Our experimental results show that DAMON can effectively induce undesired behaviors."
}</code></pre>`,
    isNew: false,
    isPreprint: false,
    isSelected: true
  },
  {
    title: "Gödel Agent: A Self-Referential Agent Framework for Recursive Self-Improvement",
    authors: "<b>Xunjian Yin</b>, Xinyi Wang, Liangming Pan, Xiaojun Wan, William Yang Wang",
    venue: "ACL 2025",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2025.acl-long.1354/" },
      { text: "Code", url: "https://github.com/Arvid-pku/Godel_Agent" },
      { text: "Page", url: "papers/godel-agent.html" }
    ],
    abstract: "The rapid advancement of large language models (LLMs) has significantly enhanced the capabilities of AI-driven agents across various tasks. However, existing agentic systems, whether based on fixed pipeline algorithms or pre-defined meta-learning frameworks, cannot search the whole agent design space due to the restriction of human-designed components, and thus might miss the globally optimal agent design. In this paper, we introduce Gödel Agent, a self-evolving framework inspired by the Gödel machine, enabling agents to recursively improve themselves without relying on predefined routines or fixed optimization algorithms. Gödel Agent leverages LLMs to dynamically modify its own logic and behavior, guided solely by high-level objectives through prompting. Experimental results on mathematical reasoning and complex agent tasks demonstrate that implementation of Gödel Agent can achieve continuous self-improvement, surpassing manually crafted agents in performance, efficiency, and generalizability.",
    citation: `<pre><code>@inproceedings{yin-etal-2025-godel,
    title = {G{\"o}del Agent: A Self-Referential Agent Framework for Recursively Self-Improvement},
    author = "Yin, Xunjian  and
      Wang, Xinyi  and
      Pan, Liangming  and
      Lin, Li  and
      Wan, Xiaojun  and
      Wang, William Yang",
    editor = "Che, Wanxiang  and
      Nabende, Joyce  and
      Shutova, Ekaterina  and
      Pilehvar, Mohammad Taher",
    booktitle = "Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)",
    month = jul,
    year = "2025",
    address = "Vienna, Austria",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2025.acl-long.1354/",
    doi = "10.18653/v1/2025.acl-long.1354",
    pages = "27890--27913",
    ISBN = "979-8-89176-251-0",
    abstract = {The rapid advancement of large language models (LLMs) has significantly enhanced the capabilities of agents across various tasks. However, existing agentic systems, whether based on fixed pipeline algorithms or pre-defined meta-learning frameworks, cannot search the whole agent design space due to the restriction of human-designed components, and thus might miss the more optimal agent design. In this paper, we introduce G{\"o}del Agent, a self-evolving framework inspired by the G{\"o}del Machine, enabling agents to recursively improve themselves without relying on predefined routines or fixed optimization algorithms. G{\"o}del Agent leverages LLMs to dynamically modify its own logic and behavior, guided solely by high-level objectives through prompting. Experimental results on multiple domains demonstrate that the implementation of G{\"o}del Agent can achieve continuous self-improvement, surpassing manually crafted agents in performance, efficiency, and generalizability.}
}</code></pre>`,
    isNew: false,
    isPreprint: false,
    isSelected: true
  },
  {
    title: "MC-MKE: A Fine-Grained Multimodal Knowledge Editing Benchmark Emphasizing Modality Consistency",
    authors: "Junzhe Zhang, Huixuan Zhang, <b>Xunjian Yin</b>, Baizhou Huang, Xu Zhang, Xinyu Hu, Xiaojun Wan",
    venue: "ACL 2025 Findings ",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2025.findings-acl.896/" },
      { text: "Code", url: "https://github.com/reroze/MC-MKE" },
      { text: "Page", url: "papers/mc-mke.html" }
    ],
    abstract: "Multimodal large language models (MLLMs) are prone to non-factual or outdated knowledge issues, which can manifest as misreading and misrecognition errors due to the complexity of multimodal knowledge. Previous benchmarks have not systematically analyzed the performance of editing methods in correcting these two error types. To better represent and correct these errors, we decompose multimodal knowledge into its visual and textual components. Different error types correspond to different editing formats, which edit distinct parts of the multimodal knowledge. We present MC-MKE, a fine-grained Multimodal Knowledge Editing benchmark emphasizing Modality Consistency. Our benchmark facilitates independent correction of misreading and misrecognition errors by editing the corresponding knowledge component. We evaluate four multimodal knowledge editing methods on MC-MKE, revealing their limitations, particularly in terms of modality consistency. Our work highlights the challenges posed by multimodal knowledge editing and motivates further research in developing effective techniques for this task.",
    citation: `<pre><code>@inproceedings{zhang-etal-2025-mc,
    title = "{MC}-{MKE}: A Fine-Grained Multimodal Knowledge Editing Benchmark Emphasizing Modality Consistency",
    author = "Zhang, Junzhe  and
      Zhang, Huixuan  and
      Yin, Xunjian  and
      Huang, Baizhou  and
      Zhang, Xu  and
      Hu, Xinyu  and
      Wan, Xiaojun",
    editor = "Che, Wanxiang  and
      Nabende, Joyce  and
      Shutova, Ekaterina  and
      Pilehvar, Mohammad Taher",
    booktitle = "Findings of the Association for Computational Linguistics: ACL 2025",
    month = jul,
    year = "2025",
    address = "Vienna, Austria",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2025.findings-acl.896/",
    doi = "10.18653/v1/2025.findings-acl.896",
    pages = "17430--17445",
    ISBN = "979-8-89176-256-5",
    abstract = "Multimodal large language models (MLLMs) are prone to non-factual or outdated knowledge issues, highlighting the importance of knowledge editing. Many benchmark has been proposed for researching multimodal knowledge editing. However, previous benchmarks focus on limited scenarios due to the lack of rigorous definition of multimodal knowledge. To better evaluate multimodal knowledge editing, we propose a decomposed definition of multimodal knowledge. Following the decomposed definition of multimodal knowledge, we introduce three scenarios and a novel requirement modality consistency. We construct MC-MKE, a fine-grained **M**ultimodal **K**nowledge **E**diting benchmark emphasizing **M**odality **C**onsistency through strict data selection. We evaluate four multimodal knowledge editing methods on MC-MKE, revealing their limitations, particularly in terms of modality consistency. Our work highlights the challenges posed by multimodal knowledge editing and motivates further research in developing effective techniques for this task."
}</code></pre>`,
    isNew: false,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "Understanding the interplay between parametric and contextual knowledge for large language models",
    authors: "Sitao Cheng, Liangming Pan, <b>Xunjian Yin</b>, Xinyi Wang, William Yang Wang",
    venue: "KnowLM Workshop, ACL 2025",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2410.08414" },
      { text: "Code", url: "https://github.com/sitaocheng/Knowledge_Interplay" },
      { text: "Page", url: "papers/knowledge-interplay.html" }
    ],
    abstract: "Large language models (LLMs) encode vast amounts of knowledge during pre-training (parametric knowledge, or PK) and can further be enhanced by incorporating contextual knowledge (CK). Can LLMs effectively integrate their internal PK with external CK to solve complex problems? In this paper, we investigate the dynamic interaction between PK and CK, categorizing their relationships into four types: Supportive, Complementary, Conflicting, and Irrelevant. To support this investigation, we introduce ECHOQA, a benchmark spanning scientific, factual, and commonsense knowledge. Our results show that LLMs tend to suppress their PK when contextual information is available, even when it is complementary or irrelevant. While tailored instructions can encourage LLMs to rely more on their PK, they still struggle to fully leverage it. These findings reveal a key vulnerability in LLMs, raising concerns about their reliability in knowledge-intensive tasks. Resources are available at https://github.com/sitaocheng/Knowledge_Interplay",
    citation: `<pre><code>@inproceedings{
cheng2025understanding,
title={Understanding the Interplay between Parametric and Contextual Knowledge for Large Language Models},
author={Sitao Cheng and Liangming Pan and Xunjian Yin and Xinyi Wang and William Yang Wang},
booktitle={Knowledgeable Foundation Models at ACL 2025},
year={2025},
url={https://openreview.net/forum?id=4uisAcagzw}
}</code></pre>`,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "LLM-based NLG Evaluation: Current Status and Challenges",
    authors: "Mingqi Gao, Xinyu Hu, <b>Xunjian Yin</b>, Jie Ruan, Xiao Pu, Xiaojun Wan",
    venue: "Computational Linguistics 2025",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2025.cl-2.9/" },
      { text: "Page", url: "papers/nlg-evaluation-survey.html" }
    ],
    abstract: "Evaluating natural language generation (NLG) is a vital but challenging problem in natural language processing. Traditional evaluation metrics mainly capturing content (e.g. n-gram) overlap between system outputs and references are far from satisfactory, and large language models (LLMs) such as ChatGPT have demonstrated great potential in NLG evaluation in recent years. Various automatic evaluation methods based on LLMs have been proposed, including metrics derived from LLMs, prompting LLMs, fine-tuning LLMs, and human-LLM collaborative evaluation. In this survey, we first give a taxonomy of LLM-based NLG evaluation methods, and discuss their pros and cons, respectively. Lastly, we discuss several open problems in this area and point out future research directions.",
    citation: `<pre><code>@article{gao-etal-2025-llm,
    title = "{LLM}-based {NLG} Evaluation: Current Status and Challenges",
    author = "Gao, Mingqi  and
      Hu, Xinyu  and
      Yin, Xunjian  and
      Ruan, Jie  and
      Pu, Xiao  and
      Wan, Xiaojun",
    journal = "Computational Linguistics",
    volume = "51",
    month = jun,
    year = "2025",
    address = "Cambridge, MA",
    publisher = "MIT Press",
    url = "https://aclanthology.org/2025.cl-2.9/",
    doi = "10.1162/coli_a_00561",
    pages = "661--687",
    abstract = "Evaluating natural language generation (NLG) is a vital but challenging problem in natural language processing. Traditional evaluation metrics mainly capturing content (e.g., n-gram) overlap between system outputs and references are far from satisfactory, and large language models (LLMs) such as ChatGPT have demonstrated great potential in NLG evaluation in recent years. Various automatic evaluation methods based on LLMs have been proposed, including metrics derived from LLMs, prompting LLMs, fine-tuning LLMs, and human{--}LLM collaborative evaluation. In this survey, we first give a taxonomy of LLM-based NLG evaluation methods, and discuss their pros and cons, respectively. Lastly, we discuss several open problems in this area and point out future research directions."
}</code></pre>`,
    isNew: false,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "Evaluating Self-Generated Documents for Enhancing Retrieval-Augmented Generation with LLMs",
    authors: "Jiatao Li, Xinyu Hu, <b>Xunjian Yin</b> and Xiaojun Wan",
    venue: "NAACL 2025 Findings",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2025.findings-naacl.149/" },
      { text: "Code", url: "https://github.com/leejamesss/Eval_Self_Docs_RAG" },
      { text: "Page", url: "papers/self-generated-documents.html" }
    ],
    abstract: "The integration of documents generated by LLMs themselves (Self-Docs) alongside retrieved documents has emerged as a promising strategy for retrieval-augmented generation systems. However, previous research primarily focuses on optimizing the use of Self-Docs, with their inherent properties remaining underexplored. To bridge this gap, we first investigate the overall effectiveness of Self-Docs, identifying key factors that shape their contribution to RAG performance (RQ1). Building on these insights, we develop a taxonomy grounded in Systemic Functional Linguistics to compare the influence of various Self-Docs categories (RQ2) and explore strategies for combining them with external sources (RQ3). Our findings reveal which types of Self-Docs are most beneficial and offer practical guidelines for leveraging them to achieve significant improvements in knowledge-intensive question answering tasks.",
    citation: `<pre><code>@inproceedings{li-etal-2025-evaluating,
    title = "Evaluating Self-Generated Documents for Enhancing Retrieval-Augmented Generation with Large Language Models",
    author = "Li, Jiatao  and
      Hu, Xinyu  and
      Yin, Xunjian  and
      Wan, Xiaojun",
    editor = "Chiruzzo, Luis  and
      Ritter, Alan  and
      Wang, Lu",
    booktitle = "Findings of the Association for Computational Linguistics: NAACL 2025",
    month = apr,
    year = "2025",
    address = "Albuquerque, New Mexico",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2025.findings-naacl.149/",
    doi = "10.18653/v1/2025.findings-naacl.149",
    pages = "2741--2775",
    ISBN = "979-8-89176-195-7",
    abstract = "The integration of documents generated by LLMs themselves (Self-Docs) alongside retrieved documents has emerged as a promising strategy for retrieval-augmented generation systems. However, previous research primarily focuses on optimizing the use of Self-Docs, with their inherent properties remaining underexplored. To bridge this gap, we first investigate the overall effectiveness of Self-Docs, identifying key factors that shape their contribution to RAG performance (RQ1). Building on these insights, we develop a taxonomy grounded in Systemic Functional Linguistics to compare the influence of various Self-Docs categories (RQ2) and explore strategies for combining them with external sources (RQ3). Our findings reveal which types of Self-Docs are most beneficial and offer practical guidelines for leveraging them to achieve significant improvements in knowledge-intensive question answering tasks."
}</code></pre>`,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "ChemAgent: Self-updating Memories in LLMs Improves Chemical Reasoning",
    authors: "Xiangru Tang, Tianyu Hu, Muyang Ye, Yanjun Shao, <b>Xunjian Yin</b>, Siru Ouyang, Wangchunshu Zhou, Pan Lu, Zhuosheng Zhang, Yilun Zhao, Arman Cohan, Mark Gerstein",
    venue: "ICLR 2025",
    links: [
      { text: "Paper", url: "https://openreview.net/forum?id=kuhIqeVg0e" },
      { text: "Code", url: "https://github.com/gersteinlab/chemagent" },
      { text: "Page", url: "papers/chemagent.html" }
    ],
    abstract: "Chemical reasoning usually involves complex, multi-step processes that demand precise calculations, where even minor errors can lead to cascading failures. Furthermore, large language models (LLMs) encounter difficulties handling domain-specific formulas, executing reasoning steps accurately, and integrating code effectively when tackling chemical reasoning tasks. To address these challenges, we present ChemAgent, a novel framework designed to improve the performance of LLMs through a dynamic, self-updating library. This library is developed by decomposing chemical tasks into sub-tasks and compiling these sub-tasks into a structured collection that can be referenced for future queries. Then, when presented with a new problem, ChemAgent retrieves and refines pertinent information from the library, which we call memory, facilitating effective task decomposition and the generation of solutions. Our method designs three types of memory and a library-enhanced reasoning component, enabling LLMs to improve over time through experience. Experimental results on four chemical reasoning datasets from SciBench demonstrate that ChemAgent achieves performance gains of up to 46% (GPT-4), significantly outperforming existing methods. Our findings suggest substantial potential for future applications, including tasks such as drug discovery and materials science. Our code can be found at https://github.com/gersteinlab/chemagent",
    citation: `<pre><code>@inproceedings{
tang2025chemagent,
title={ChemAgent: Self-updating Memories in Large Language Models Improves Chemical Reasoning},
author={Xiangru Tang and Tianyu Hu and Muyang Ye and Yanjun Shao and Xunjian Yin and Siru Ouyang and Wangchunshu Zhou and Pan Lu and Zhuosheng Zhang and Yilun Zhao and Arman Cohan and Mark Gerstein},
booktitle={The Thirteenth International Conference on Learning Representations},
year={2025},
url={https://openreview.net/forum?id=kuhIqeVg0e}
}</code></pre>`,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "DSGram: Dynamic Weighting Sub-Metrics for Grammatical Error Correction in the Era of Large Language Models",
    authors: "Jinxiang Xie, Yilin Li, <b>Xunjian Yin</b> (as Mentor), Xiaojun Wan",
    venue: "AAAI 2025",
    links: [
      { text: "Paper", url: "https://ojs.aaai.org/index.php/AAAI/article/view/34746/36901" },
      { text: "Code", url: "https://github.com/PKU-ONELab/" },
      { text: "Page", url: "papers/dsgram.html" }
    ],
    abstract: "Evaluating the performance of Grammatical Error Correction (GEC) models has become increasingly challenging, as large language model (LLM)-based GEC systems often produce corrections that diverge from provided gold references. This discrepancy undermines the reliability of traditional reference-based evaluation metrics. In this study, we propose a novel evaluation framework for GEC models, DSGram, integrating Semantic Coherence, Edit Level, and Fluency, and utilizing a dynamic weighting mechanism. Our framework employs the Analytic Hierarchy Process (AHP) in conjunction with large language models to ascertain the relative importance of various evaluation criteria. Additionally, we develop a dataset incorporating human annotations and LLM-simulated sentences to validate our algorithms and fine-tune more cost-effective models. Experimental results indicate that our proposed approach enhances the effectiveness of GEC model evaluations.",
    citation: `<pre><code>@inproceedings{xie2025dsgram,
  title={DSGram: Dynamic Weighting Sub-Metrics for Grammatical Error Correction in the Era of Large Language Models},
  author={Xie, Jinxiang and Li, Yilin and Yin, Xunjian and Wan, Xiaojun},
  booktitle={Proceedings of the AAAI Conference on Artificial Intelligence},
  volume={39},
  number={24},
  pages={25561--25569},
  year={2025}
}</code></pre>`,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "Themis: A Reference-free NLG Evaluation Language Model with Flexibility and Interpretability",
    authors: "Xinyu Hu, Li Lin, Mingqi Gao, <b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "EMNLP 2024",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2024.emnlp-main.891/" },
      { text: "Code", url: "https://github.com/PKU-ONELab/Themis" },
      { text: "Page", url: "papers/themis.html" }
    ],
    abstract: "The evaluation of natural language generation (NLG) tasks is a significant and longstanding research area. With the recent emergence of powerful large language models (LLMs), some studies have turned to LLM-based automatic evaluation methods, which demonstrate great potential to become a new evaluation paradigm following traditional string-based and model-based metrics. However, despite the improved performance of existing methods, they still possess some deficiencies, such as dependency on references and limited evaluation flexibility. Therefore, in this paper, we meticulously construct a large-scale NLG evaluation corpus NLG-Eval with annotations from both human and GPT-4 to alleviate the lack of relevant data in this field. Furthermore, we propose Themis, an LLM dedicated to NLG evaluation, which has been trained with our designed multi-perspective consistency verification and rating-oriented preference alignment methods. Themis can conduct flexible and interpretable evaluations without references, and it exhibits superior evaluation performance on various NLG tasks, simultaneously generalizing well to unseen tasks and surpassing other evaluation models, including GPT-4.",
    citation: `<pre><code>@inproceedings{hu-etal-2024-themis,
    title = "Themis: A Reference-free {NLG} Evaluation Language Model with Flexibility and Interpretability",
    author = "Hu, Xinyu  and
      Lin, Li  and
      Gao, Mingqi  and
      Yin, Xunjian  and
      Wan, Xiaojun",
    editor = "Al-Onaizan, Yaser  and
      Bansal, Mohit  and
      Chen, Yun-Nung",
    booktitle = "Proceedings of the 2024 Conference on Empirical Methods in Natural Language Processing",
    month = nov,
    year = "2024",
    address = "Miami, Florida, USA",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2024.emnlp-main.891/",
    doi = "10.18653/v1/2024.emnlp-main.891",
    pages = "15924--15951",
    abstract = "The evaluation of natural language generation (NLG) tasks is a significant and longstanding research area. With the recent emergence of powerful large language models (LLMs), some studies have turned to LLM-based automatic evaluation methods, which demonstrate great potential to become a new evaluation paradigm following traditional string-based and model-based metrics. However, despite the improved performance of existing methods, they still possess some deficiencies, such as dependency on references and limited evaluation flexibility. Therefore, in this paper, we meticulously construct a large-scale NLG evaluation corpus **NLG-Eval** with annotations from both human and GPT-4 to alleviate the lack of relevant data in this field. Furthermore, we propose **Themis**, an LLM dedicated to NLG evaluation, which has been trained with our designed multi-perspective consistency verification and rating-oriented preference alignment methods. Themis can conduct flexible and interpretable evaluations without references, and it exhibits superior evaluation performance on various NLG tasks, simultaneously generalizing well to unseen tasks and surpassing other evaluation models, including GPT-4."
}</code></pre>`,
    isPreprint: false,
    isSelected: true
  },
  {
    title: "Benchmarking Knowledge Boundary for Large Language Model: A Different Perspective on Model Evaluation",
    authors: "<b>Xunjian Yin*</b>, Xu Zhang*, Jie Ruan, Xiaojun Wan",
    venue: "ACL 2024",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2024.acl-long.124/" },
      { text: "Code", url: "https://github.com/pkulcwmzx/knowledge-boundary" },
      { text: "Page", url: "papers/knowledge-boundary.html" }
    ],
    abstract: "In recent years, substantial advancements have been made in the development of large language models, achieving remarkable performance across diverse tasks. To evaluate the knowledge ability of language models, previous studies have proposed lots of benchmarks based on question-answering pairs. We argue that it is not reliable and comprehensive to evaluate language models with a fixed question or limited paraphrases as the query, since language models are sensitive to prompt. Therefore, we introduce a novel concept named knowledge boundary to encompass both prompt-agnostic and prompt-sensitive knowledge within language models. Knowledge boundary avoids prompt sensitivity in language model evaluations, rendering them more dependable and robust. To explore the knowledge boundary for a given model, we propose projected gradient descent method with semantic constraints, a new algorithm designed to identify the optimal prompt for each piece of knowledge. Experiments demonstrate a superior performance of our algorithm in computing the knowledge boundary compared to existing methods. Furthermore, we evaluate the ability of multiple language models in several domains with knowledge boundary.",
    citation: `<pre><code>@inproceedings{yin-etal-2024-benchmarking,
    title = "Benchmarking Knowledge Boundary for Large Language Models: A Different Perspective on Model Evaluation",
    author = "Yin, Xunjian  and
      Zhang, Xu  and
      Ruan, Jie  and
      Wan, Xiaojun",
    editor = "Ku, Lun-Wei  and
      Martins, Andre  and
      Srikumar, Vivek",
    booktitle = "Proceedings of the 62nd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)",
    month = aug,
    year = "2024",
    address = "Bangkok, Thailand",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2024.acl-long.124/",
    doi = "10.18653/v1/2024.acl-long.124",
    pages = "2270--2286",
    abstract = "In recent years, substantial advancements have been made in the development of large language models, achieving remarkable performance across diverse tasks.To evaluate the knowledge ability of language models, previous studies have proposed lots of benchmarks based on question-answering pairs.We argue that it is not reliable and comprehensive to evaluate language models with a fixed question or limited paraphrases as the query, since language models are sensitive to prompt.Therefore, we introduce a novel concept named knowledge boundary to encompass both prompt-agnostic and prompt-sensitive knowledge within language models.Knowledge boundary avoids prompt sensitivity in language model evaluations, rendering them more dependable and robust.To explore the knowledge boundary for a given model, we propose projected gradient descent method with semantic constraints, a new algorithm designed to identify the optimal prompt for each piece of knowledge.Experiments demonstrate a superior performance of our algorithm in computing the knowledge boundary compared to existing methods.Furthermore, we evaluate the ability of multiple language models in several domains with knowledge boundary."
}</code></pre>`,
    isPreprint: false,
    isSelected: true
  },
  {
    title: "History Matters: Temporal Knowledge Editing in Large Language Model",
    authors: "<b>Xunjian Yin</b>, Jin Jiang, Liming Yang, Xiaojun Wan",
    venue: "AAAI 2024",
    links: [
      { text: "Paper", url: "https://ojs.aaai.org/index.php/AAAI/article/view/29912/31594" },
      { text: "Code", url: "https://github.com/Arvid-pku/ATOKE" },
      { text: "Page", url: "papers/history-matters.html" }
    ],
    abstract: "The imperative task of revising or updating the knowledge stored within large language models arises from two distinct sources: intrinsic errors inherent in the model which should be corrected and outdated knowledge due to external shifts in the real world which should be updated. Prevailing efforts in model editing conflate these two distinct categories of edits arising from distinct reasons and directly modify the original knowledge in models into new knowledge. However, we argue that preserving the model's original knowledge remains pertinent. Specifically, if a model's knowledge becomes outdated due to evolving worldly dynamics, it should retain recollection of the historical knowledge while integrating the newfound knowledge. In this work, we introduce the task of Temporal Knowledge Editing (TKE) and establish a benchmark AToKe (Assessment of TempOral Knowledge Editing) to evaluate current model editing methods. We find that while existing model editing methods are effective at making models remember new knowledge, the edited model catastrophically forgets historical knowledge. To address this gap, we propose a simple and general framework termed Multi-Editing with Time Objective (METO) for enhancing existing editing models, which edits both historical and new knowledge concurrently and optimizes the model's prediction for the time of each fact. Our assessments demonstrate that while AToKe is still difficult, METO maintains the effectiveness of learning new knowledge and meanwhile substantially improves the performance of edited models on utilizing historical knowledge.",
    citation: `<pre><code>@inproceedings{yin2024history,
  title={History matters: Temporal knowledge editing in large language model},
  author={Yin, Xunjian and Jiang, Jin and Yang, Liming and Wan, Xiaojun},
  booktitle={Proceedings of the AAAI Conference on Artificial Intelligence},
  volume={38},
  number={17},
  pages={19413--19421},
  year={2024}
}</code></pre>`,
    isPreprint: false,
    isSelected: true
  },
  {
    title: "Error-Robust Retrieval for Chinese Spelling Check",
    authors: "<b>Xunjian Yin</b>, Xinyu Hu, Jin Jiang, Xiaojun Wan",
    venue: "COLING 2024",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2024.lrec-main.553/" },
      { text: "Code", url: "https://github.com/PKU-ONELab/" },
      { text: "Page", url: "papers/error-robust-retrieval.html" }
    ],
    abstract: "Chinese Spelling Check (CSC) aims to detect and correct error tokens in Chinese contexts, which has a wide range of applications. However, it is confronted with the challenges of insufficient annotated data and the issue that previous methods may actually not fully leverage the existing datasets. In this paper, we introduce our plug-and-play retrieval method with error-robust information for Chinese Spelling Check (RERIC), which can be directly applied to existing CSC models. The datastore for retrieval is built completely based on the training data, with elaborate designs according to the characteristics of CSC. Specifically, we employ multimodal representations that fuse phonetic, morphologic, and contextual information in the calculation of query and key during retrieval to enhance robustness against potential errors. Furthermore, in order to better judge the retrieved candidates, the n-gram surrounding the token to be checked is regarded as the value and utilized for specific reranking. The experiment results on the SIGHAN benchmarks demonstrate that our proposed method achieves substantial improvements over existing work.",
    citation: `<pre><code>@inproceedings{yin-etal-2024-error,
    title = "Error-Robust Retrieval for {C}hinese Spelling Check",
    author = "Yin, Xunjian  and
      Hu, Xinyu  and
      Jiang, Jin  and
      Wan, Xiaojun",
    editor = "Calzolari, Nicoletta  and
      Kan, Min-Yen  and
      Hoste, Veronique  and
      Lenci, Alessandro  and
      Sakti, Sakriani  and
      Xue, Nianwen",
    booktitle = "Proceedings of the 2024 Joint International Conference on Computational Linguistics, Language Resources and Evaluation (LREC-COLING 2024)",
    month = may,
    year = "2024",
    address = "Torino, Italia",
    publisher = "ELRA and ICCL",
    url = "https://aclanthology.org/2024.lrec-main.553/",
    pages = "6257--6267",
    abstract = "Chinese Spelling Check (CSC) aims to detect and correct error tokens in Chinese contexts, which has a wide range of applications. However, it is confronted with the challenges of insufficient annotated data and the issue that previous methods may actually not fully leverage the existing datasets. In this paper, we introduce our plug-and-play retrieval method with error-robust information for Chinese Spelling Check (RERIC), which can be directly applied to existing CSC models. The datastore for retrieval is built completely based on the training data, with elaborate designs according to the characteristics of CSC. Specifically, we employ multimodal representations that fuse phonetic, morphologic, and contextual information in the calculation of query and key during retrieval to enhance robustness against potential errors. Furthermore, in order to better judge the retrieved candidates, the n-gram surrounding the token to be checked is regarded as the value and utilized for specific reranking. The experiment results on the SIGHAN benchmarks demonstrate that our proposed method achieves substantial improvements over existing work."
}</code></pre>`,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "Contextual Modeling for Document-level ASR Error Correction",
    authors: "Jin Jiang, <b>Xunjian Yin</b>, Xiaojun Wan, Wei Peng, Rongjun Li, Jingyuan Yang, and Yanquan Zhou",
    venue: "COLING 2024",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2024.lrec-main.341/" },
      { text: "Code", url: "https://github.com/jiangjin1999/context_ASR" },
      { text: "Page", url: "papers/contextual-asr.html" }
    ],
    abstract: "Contextual information, including the sentences in the same document and in other documents of the dataset, plays a crucial role in improving the accuracy of document-level ASR Error Correction (AEC), while most previous works ignore this. In this paper, we propose a context-aware method that utilizes a k -Nearest Neighbors ( k NN) approach to enhance the AEC model by retrieving a datastore containing contextual information. We conduct experiments on two English and two Chinese datasets, and the results demonstrate that our proposed model can effectively utilize contextual information to improve document-level AEC. Furthermore, the context information from the whole dataset provides even better results.",
    citation: `<pre><code>@inproceedings{jiang-etal-2024-contextual,
    title = "Contextual Modeling for Document-level {ASR} Error Correction",
    author = "Jiang, Jin  and
      Yin, Xunjian  and
      Wan, Xiaojun  and
      Peng, Wei  and
      Li, Rongjun  and
      Yang, Jingyuan  and
      Zhou, Yanquan",
    editor = "Calzolari, Nicoletta  and
      Kan, Min-Yen  and
      Hoste, Veronique  and
      Lenci, Alessandro  and
      Sakti, Sakriani  and
      Xue, Nianwen",
    booktitle = "Proceedings of the 2024 Joint International Conference on Computational Linguistics, Language Resources and Evaluation (LREC-COLING 2024)",
    month = may,
    year = "2024",
    address = "Torino, Italia",
    publisher = "ELRA and ICCL",
    url = "https://aclanthology.org/2024.lrec-main.341/",
    pages = "3855--3867"
}</code></pre>`,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "ALCUNA: Large Language Models Meet New Knowledge",
    authors: "<b>Xunjian Yin*</b>, Baizhou Huang*, Xiaojun Wan",
    venue: "EMNLP 2023",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2023.emnlp-main.87/" },
      { text: "Code", url: "https://github.com/arvid-pku/alcuna" },
      { text: "Page", url: "papers/alcuna.html" }
    ],
    abstract: "With the rapid development of NLP, large-scale language models (LLMs) excel in various tasks across multiple domains now. However, existing benchmarks may not adequately measure these models' capabilities, especially when faced with new knowledge. In this paper, we address the lack of benchmarks to evaluate LLMs' ability to handle new knowledge, an important and challenging aspect in the rapidly evolving world. We propose an approach called KnowGen that generates new knowledge by altering existing entity attributes and relationships, resulting in artificial entities that are distinct from real-world entities. With KnowGen, we introduce a benchmark named ALCUNA to assess LLMs' abilities in knowledge understanding, differentiation, and association. We benchmark several LLMs, reveals that their performance in face of new knowledge is not satisfactory, particularly in reasoning between new and internal knowledge. We also explore the impact of entity similarity on the model's understanding of entity knowledge and the influence of contextual entities. We appeal to the need for caution when using LLMs in new scenarios or with new knowledge, and hope that our benchmarks can help drive the development of LLMs in face of new knowledge.",
    citation: `<pre><code>@inproceedings{yin-etal-2023-alcuna,
    title = "{ALCUNA}: Large Language Models Meet New Knowledge",
    author = "Yin, Xunjian  and
      Huang, Baizhou  and
      Wan, Xiaojun",
    editor = "Bouamor, Houda  and
      Pino, Juan  and
      Bali, Kalika",
    booktitle = "Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing",
    month = dec,
    year = "2023",
    address = "Singapore",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2023.emnlp-main.87/",
    doi = "10.18653/v1/2023.emnlp-main.87",
    pages = "1397--1414",
    abstract = "With the rapid development of NLP, large-scale language models (LLMs) excel in various tasks across multiple domains now. However, existing benchmarks may not adequately measure these models' capabilities, especially when faced with new knowledge. In this paper, we address the lack of benchmarks to evaluate LLMs' ability to handle new knowledge, an important and challenging aspect in the rapidly evolving world. We propose an approach called KnowGen that generates new knowledge by altering existing entity attributes and relationships, resulting in artificial entities that are distinct from real-world entities. With KnowGen, we introduce a benchmark named ALCUNA to assess LLMs' abilities in knowledge understanding, differentiation, and association. We benchmark several LLMs, reveals that their performance in face of new knowledge is not satisfactory, particularly in reasoning between new and internal knowledge. We also explore the impact of entity similarity on the model{'}s understanding of entity knowledge and the influence of contextual entities. We appeal to the need for caution when using LLMs in new scenarios or with new knowledge, and hope that our benchmarks can help drive the development of LLMs in face of new knowledge."
}</code></pre>`,
    isPreprint: false,
    isSelected: true
  },
  {
    title: "Exploring Context-Aware Evaluation Metrics for Machine Translation",
    authors: "Xinyu Hu, <b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "EMNLP 2023 Findings",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2023.findings-emnlp.1021/" },
      { text: "Code", url: "https://github.com/herrxy/Cont-COMET" },
      { text: "Page", url: "papers/context-aware-evaluation.html" }
    ],
    abstract: "Previous studies on machine translation evaluation mostly focused on the quality of individual sentences, while overlooking the important role of contextual information. Although WMT Metrics Shared Tasks have introduced context content into the human annotations of translation evaluation since 2019, the relevant metrics and methods still did not take advantage of the corresponding context. In this paper, we propose a context-aware machine translation evaluation metric called Cont-COMET, built upon the effective COMET framework. Our approach simultaneously considers the preceding and subsequent contexts of the sentence to be evaluated and trains our metric to be aligned with the setting during human annotation. We also introduce a content selection method to extract and utilize the most relevant information. The experiments and evaluation of Cont-COMET on the official test framework from WMT show improvements in both system-level and segment-level assessments.",
    citation: `<pre><code>@inproceedings{hu-etal-2023-exploring,
    title = "Exploring Context-Aware Evaluation Metrics for Machine Translation",
    author = "Hu, Xinyu  and
      Yin, Xunjian  and
      Wan, Xiaojun",
    editor = "Bouamor, Houda  and
      Pino, Juan  and
      Bali, Kalika",
    booktitle = "Findings of the Association for Computational Linguistics: EMNLP 2023",
    month = dec,
    year = "2023",
    address = "Singapore",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2023.findings-emnlp.1021/",
    doi = "10.18653/v1/2023.findings-emnlp.1021",
    pages = "15291--15298",
    abstract = "Previous studies on machine translation evaluation mostly focused on the quality of individual sentences, while overlooking the important role of contextual information. Although WMT Metrics Shared Tasks have introduced context content into the human annotations of translation evaluation since 2019, the relevant metrics and methods still did not take advantage of the corresponding context. In this paper, we propose a context-aware machine translation evaluation metric called Cont-COMET, built upon the effective COMET framework. Our approach simultaneously considers the preceding and subsequent contexts of the sentence to be evaluated and trains our metric to be aligned with the setting during human annotation. We also introduce a content selection method to extract and utilize the most relevant information. The experiments and evaluation of Cont-COMET on the official test framework from WMT show improvements in both system-level and segment-level assessments."
}</code></pre>`,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "How Do Seq2Seq Models Perform on End-to-End Data-to-Text Generation?",
    authors: "<b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "ACL 2022",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2022.acl-long.531.pdf" },
      { text: "Code", url: "https://github.com/xunjianyin/Seq2SeqOnData2Text" },
      { text: "Page", url: "papers/seq2seq-data2text.html" }
    ],
    abstract: "With the rapid development of deep learning, Seq2Seq paradigm has become prevalent for end-to-end data-to-text generation, and the BLEU scores have been increasing in recent years. However, it is widely recognized that there is still a gap between the quality of the texts generated by models and the texts written by human. In order to better understand the ability of Seq2Seq models, evaluate their performance and analyze the results, we choose to use Multidimensional Quality Metric(MQM) to evaluate several representative Seq2Seq models on end-to-end data-to-text generation. We annotate the outputs of five models on four datasets with eight error types and find that 1) copy mechanism is helpful for the improvement in Omission and Inaccuracy Extrinsic errors but it increases other types of errors such as Addition; 2) pre-training techniques are highly effective, and pre-training strategy and model size are very significant; 3) the structure of the dataset also influences the model's performance greatly; 4) some specific types of errors are generally challenging for seq2seq models.",
    citation: `<pre><code>@inproceedings{yin-wan-2022-seq2seq,
    title = "How Do {S}eq2{S}eq Models Perform on End-to-End Data-to-Text Generation?",
    author = "Yin, Xunjian  and
      Wan, Xiaojun",
    editor = "Muresan, Smaranda  and
      Nakov, Preslav  and
      Villavicencio, Aline",
    booktitle = "Proceedings of the 60th Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)",
    month = may,
    year = "2022",
    address = "Dublin, Ireland",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2022.acl-long.531/",
    doi = "10.18653/v1/2022.acl-long.531",
    pages = "7701--7710"
}</code></pre>`,
    isPreprint: false,
    isSelected: true
  }
];

// Helper functions to filter publications
const getPreprints = () => publications.filter(pub => pub.isPreprint);
const getSelectedPreprints = () => publications.filter(pub => pub.isPreprint && pub.isSelected);
const getPublications = () => publications.filter(pub => !pub.isPreprint);
const getSelectedPublications = () => publications.filter(pub => !pub.isPreprint && pub.isSelected);
const getAllPublications = () => publications.filter(pub => !pub.isPreprint);

// Legacy variables for backward compatibility (will be removed after updating main.js)
const preprints = getSelectedPreprints();
const selectedPublications = getSelectedPublications();
const fullPublications = getAllPublications();

// Projects Data
const projects = [
  {
    title: "Overleaf-Bib-Helper",
    description: "A <a href=\"https://greasyfork.org/scripts/532304-overleaf-bib-helper\">Userscript</a> to enhance Overleaf by allowing article searches and BibTeX retrieval directly within the Overleaf editor. (<a href=\"https://github.com/MLNLP-World/Overleaf-Bib-Helper\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/releases", img: "https://img.shields.io/badge/Version-1.3-blue" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/stargazers", img: "https://img.shields.io/github/stars/MLNLP-World/Overleaf-Bib-Helper" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/network/members", img: "https://img.shields.io/github/forks/MLNLP-World/Overleaf-Bib-Helper" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/issues", img: "https://img.shields.io/github/issues/MLNLP-World/Overleaf-Bib-Helper" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
      { url: "https://greasyfork.org/zh-CN/scripts/532304-overleaf-bib-helper", img: "https://img.shields.io/badge/Install-Greasy_Fork-blue" }
    ],
    isSelected: true,
    demoPath: "photos/project-demo/Overleaf-Bib-Helper.jpg"
  },
  {
    title: "Gödel Agent",
    description: "A self-referential agent framework for recursive self-improvement implemented with Monkey Patching. (<a href=\"https://github.com/Arvid-pku/Godel_Agent\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/Arvid-pku/Godel_Agent/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/Arvid-pku/Godel_Agent/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/Arvid-pku/Godel_Agent/stargazers", img: "https://img.shields.io/github/stars/Arvid-pku/Godel_Agent" },
      { url: "https://github.com/Arvid-pku/Godel_Agent/network/members", img: "https://img.shields.io/github/forks/Arvid-pku/Godel_Agent" },
      { url: "https://github.com/Arvid-pku/Godel_Agent/issues", img: "https://img.shields.io/github/issues/Arvid-pku/Godel_Agent" },
      { url: "https://github.com/Arvid-pku/Godel_Agent/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
      { url: "https://arxiv.org/abs/2410.04444", img: "https://img.shields.io/badge/Doc-Paper-red" }
    ],
    isSelected: true,
    demoPath: "photos/project-demo/Gödel Agent.png"
  },
  {
    title: "LLM Interpretability Workbench",
    description: "A workbench for interpreting the internals of large language models. (<a href=\"https://github.com/Arvid-pku/Modelen\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/Arvid-pku/Modelen/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/Arvid-pku/Modelen/stargazers", img: "https://img.shields.io/github/stars/Arvid-pku/Modelen" },
      { url: "https://github.com/Arvid-pku/Modelen/issues", img: "https://img.shields.io/github/issues/Arvid-pku/Modelen" },
      { url: "https://github.com/Arvid-pku/Modelen/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" }
    ],
    isSelected: true,
    demoPath: "photos/project-demo/Model_Len.png"
  },
  {
    title: "History Visualization",
    description: "A web application that visualizes world history through an interactive timeline and map. (<a href=\"https://arvid-pku.github.io/history_vis/\">Project Homepage</a>)",
    badges: [
      { url: "https://arvid-pku.github.io/history_vis/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://arvid-pku.github.io/history_vis/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
    ],
    isSelected: false,
    demoPath: "photos/project-demo/History Visualization.png"
  },
  {
    title: "Tower of Babel",
    description: "Play with Text in the Physical World. (<a href=\"https://arvid-pku.github.io/Babel/\">Project Homepage</a>)",
    badges: [
      { url: "https://arvid-pku.github.io/Babel/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://arvid-pku.github.io/Babel/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
    ],
    isSelected: false,
    demoPath: "photos/project-demo/Tower of Babel.png"
  },
    {
    title: "World of Physics",
    description: "A physics simulation platform where we can play with blocks, spring, rope, electric field, magnetic field, and more. (<a href=\"https://arvid-pku.github.io/worldofphysics/\">Project Homepage</a>)",
    badges: [
      { url: "https://arvid-pku.github.io/worldofphysics/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://arvid-pku.github.io/worldofphysics/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
    ],
    isSelected: false,
    demoPath: "photos/project-demo/World of Physics.png"
  },
  {
    title: "Proactive AI Assistant",
    description: "An AI assistant extension that proactively helps users with tasks and reminders. (<a href=\"https://github.com/Arvid-pku/Proactive-AI\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/Arvid-pku/Proactive-AI/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/Arvid-pku/Proactive-AI/stargazers", img: "https://img.shields.io/github/stars/Arvid-pku/Proactive-AI" },
      { url: "https://github.com/Arvid-pku/Proactive-AI/issues", img: "https://img.shields.io/github/issues/Arvid-pku/Proactive-AI" },
      { url: "https://github.com/Arvid-pku/Proactive-AI/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" }
    ],
    isSelected: true,
    demoPath: "photos/project-demo/Proactive AI Assistant.png"
  },
  {
    title: "Music Letter",
    description: "Turn your letter into a song and let your heart be heard. (<a href=\"https://xunjianyin.github.io/MusicLetter\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/xunjianyin/MusicLetter/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/xunjianyin/MusicLetter/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/xunjianyin/MusicLetter/stargazers", img: "https://img.shields.io/github/stars/xunjianyin/MusicLetter" },
      { url: "https://github.com/xunjianyin/MusicLetter/network/members", img: "https://img.shields.io/github/forks/xunjianyin/MusicLetter" },
      { url: "https://github.com/xunjianyin/MusicLetter/issues", img: "https://img.shields.io/github/issues/xunjianyin/MusicLetter" },
      { url: "https://github.com/xunjianyin/MusicLetter/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
      { url: "https://xunjianyin.github.io/MusicLetter/", img: "https://img.shields.io/badge/Website-Music_Letter-blue" }
    ],
    isSelected: false,
    demoPath: "photos/project-demo/Music Letter.png"
  },
  {
    title: "Text of Sisyphus",
    description: "An interactive simulation where Sisyphus's collapse builds a text archive. (<a href=\"https://Arvid-pku.github.io/Sisyphus/\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/Arvid-pku/Sisyphus/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/Arvid-pku/Sisyphus/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/Arvid-pku/Sisyphus/stargazers", img: "https://img.shields.io/github/stars/Arvid-pku/Sisyphus" },
      { url: "https://github.com/Arvid-pku/Sisyphus/network/members", img: "https://img.shields.io/github/forks/Arvid-pku/Sisyphus" },
    ],
    isSelected: false,
    demoPath: "photos/project-demo/Text of Sisyphus.png"
  },
  //   {
  //   title: "Harmony Cube",
  //   description: "Music Meets Geometry. (<a href=\"https://arvid-pku.github.io/harmony-cube/\">Project Homepage</a>)",
  //   badges: [
  //     { url: "https://arvid-pku.github.io/harmony-cube/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
  //     { url: "https://arvid-pku.github.io/harmony-cube/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
  //   ],
  //   isSelected: false,
  //   demoPath: "photos/project-demo/Harmony Cube.png"
  // },
  {
    title: "Academic-Homepage-Template",
    description: "A template for academic homepages. (<a href=\"https://github.com/Arvid-pku/Academic-Homepage-Template\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/Arvid-pku/Academic-Homepage-Template/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/Arvid-pku/Academic-Homepage-Template/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
    ],
    isSelected: false,
    demoPath: "photos/project-demo/Academic-Homepage-Template.png"
  },
  {
    title: "Game-of-Life",
    description: "A website to play with Conway's Game of Life. (<a href=\"https://xunjianyin.github.io/Game-of-Life/\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/xunjianyin/Game-of-Life/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/xunjianyin/Game-of-Life/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/xunjianyin/Game-of-Life/stargazers", img: "https://img.shields.io/github/stars/xunjianyin/Game-of-Life" },
      { url: "https://github.com/xunjianyin/Game-of-Life/network/members", img: "https://img.shields.io/github/forks/xunjianyin/Game-of-Life" },
    ],
    isSelected: false,
    demoPath: "photos/project-demo/Game-of-Life.png"
  },
  // {
  //   title: "Audio-Visualizer",
  //   description: "A website to visualize audio. (<a href=\"https://xunjianyin.github.io/Audio-Visualizer/\">Project Homepage</a>)",
  //   badges: [
  //     { url: "https://github.com/xunjianyin/Audio-Visualizer/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
  //     { url: "https://github.com/xunjianyin/Audio-Visualizer/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
  //     { url: "https://github.com/xunjianyin/Audio-Visualizer/stargazers", img: "https://img.shields.io/github/stars/xunjianyin/Audio-Visualizer" },
  //     { url: "https://github.com/xunjianyin/Audio-Visualizer/network/members", img: "https://img.shields.io/github/forks/xunjianyin/Audio-Visualizer" },
  //   ],
  //   isSelected: false,
  //   demoPath: "photos/project-demo/Audio-Visualizer.png"
  // },
  {
    title: "Maze-Generator-And-Solver",
    description: "A website to generate and solve mazes. (<a href=\"https://xunjianyin.github.io/Maze-Generator-And-Solver/\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/xunjianyin/Maze-Generator-And-Solver/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/xunjianyin/Maze-Generator-And-Solver/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/xunjianyin/Maze-Generator-And-Solver/stargazers", img: "https://img.shields.io/github/stars/xunjianyin/Maze-Generator-And-Solver" },
      { url: "https://github.com/xunjianyin/Maze-Generator-And-Solver/network/members", img: "https://img.shields.io/github/forks/xunjianyin/Maze-Generator-And-Solver" },
    ],
    isSelected: false,
    demoPath: "photos/project-demo/Maze-Generator-And-Solver.png"
  },
  // {
  //   title: "Overleaf-Bib-Helper-Dev",
  //   description: "A UserScript to enhance Overleaf by allowing article searches and BibTeX retrieval directly within the Overleaf editor. (<a href=\"https://github.com/Arvid-pku/Overleaf-Bib-Helper\">Project Homepage</a>)",
  //   badges: [
  //     { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/releases", img: "https://img.shields.io/badge/Version-1.3-blue" },
  //     { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
  //     { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/stargazers", img: "https://img.shields.io/github/stars/Arvid-pku/Overleaf-Bib-Helper" },
  //     { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/network/members", img: "https://img.shields.io/github/forks/Arvid-pku/Overleaf-Bib-Helper" },
  //     { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/issues", img: "https://img.shields.io/github/issues/Arvid-pku/Overleaf-Bib-Helper" },
  //     { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
  //     { url: "https://greasyfork.org/zh-CN/scripts/532304-overleaf-bib-helper", img: "https://img.shields.io/badge/Install-Greasy_Fork-blue" }
  //   ],
  //   isSelected: false,
  //   demoPath: "photos/project-demo/Overleaf-Bib-Helper.jpg"
  // },
  {
    title: "Bouncing Ball",
    description: "A website to play with a ball. (<a href=\"https://xunjianyin.github.io/bouncing-ball-animation/\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/stargazers", img: "https://img.shields.io/github/stars/xunjianyin/bouncing-ball-animation" },
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/network/members", img: "https://img.shields.io/github/forks/xunjianyin/bouncing-ball-animation" },
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/issues", img: "https://img.shields.io/github/issues/xunjianyin/bouncing-ball-animation" },
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
      { url: "https://xunjianyin.github.io/bouncing-ball-animation/", img: "https://img.shields.io/badge/Website-Bouncing_Ball-blue" }
    ],
    isSelected: false,
    demoPath: "photos/project-demo/Bouncing Ball.png"
  },
  {
    title: "Star-Maker",
    description: "A website to create and explore planetary systems. (<a href=\"https://xunjianyin.github.io/star-maker/\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/xunjianyin/star-maker/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/xunjianyin/star-maker/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/xunjianyin/star-maker/stargazers", img: "https://img.shields.io/github/stars/xunjianyin/star-maker" },
      { url: "https://github.com/xunjianyin/star-maker/network/members", img: "https://img.shields.io/github/forks/xunjianyin/star-maker" },
      { url: "https://github.com/xunjianyin/star-maker/issues", img: "https://img.shields.io/github/issues/xunjianyin/star-maker" },
      { url: "https://github.com/xunjianyin/star-maker/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
      { url: "https://xunjianyin.github.io/star-maker/", img: "https://img.shields.io/badge/Website-Star_Maker-blue" }
    ],
    isSelected: false,
    demoPath: "photos/project-demo/Star-Maker.png"
  },
  {
    title: "HF-Downloader",
    description: "A <a href=\"https://greasyfork.org/zh-CN/scripts/543283-hugging-face-batch-downloader\">Tampermonkey userscript</a> that enhances Hugging Face model pages with batch download functionality. (<a href=\"https://github.com/Arvid-pku/HF-Downloader\">Project Homepage</a>)",
    badges: [
      { url: "https://greasyfork.org/zh-CN/scripts/543283-hugging-face-batch-downloader", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/Arvid-pku/HF-Downloader/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/Arvid-pku/HF-Downloader/stargazers", img: "https://img.shields.io/github/stars/Arvid-pku/HF-Downloader" },
      { url: "https://github.com/Arvid-pku/HF-Downloader/network/members", img: "https://img.shields.io/github/forks/Arvid-pku/HF-Downloader" },
    ],
    isSelected: false,
    demoPath: "photos/project-demo/HF-Downloader.png"
  },
  {
    title: "ID-Photo-Helper",
    description: "Help everyone deal with the complicated issues of ID photo format and layout. (<a href=\"https://github.com/Arvid-pku/ID-Photo-Helper\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/Arvid-pku/ID-Photo-Helper/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/Arvid-pku/ID-Photo-Helper/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/Arvid-pku/ID-Photo-Helper/stargazers", img: "https://img.shields.io/github/stars/Arvid-pku/ID-Photo-Helper" },
      { url: "https://github.com/Arvid-pku/ID-Photo-Helper/network/members", img: "https://img.shields.io/github/forks/Arvid-pku/ID-Photo-Helper" },
    ],
    isSelected: false,
    demoPath: "photos/project-demo/ID-Photo-Helper.png"
  },
  // {
  //   title: "Rank-Anything",
  //   description: "A website to rank anything (developing). (<a href=\"https://xunjianyin.github.io/rank-anything/\">Project Homepage</a>)",
  //   badges: [
  //     { url: "https://github.com/Arvid-pku/ID-Photo-Helper/releases", img: "https://img.shields.io/badge/Version-0.1-blue" },
  //     { url: "https://github.com/xunjianyin/rank-anything/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
  //     { url: "https://github.com/xunjianyin/rank-anything/stargazers", img: "https://img.shields.io/github/stars/xunjianyin/rank-anything" },
  //     { url: "https://github.com/xunjianyin/rank-anything/network/members", img: "https://img.shields.io/github/forks/xunjianyin/rank-anything" },
  //     { url: "https://github.com/xunjianyin/rank-anything/issues", img: "https://img.shields.io/github/issues/xunjianyin/rank-anything" },
  //     { url: "https://github.com/xunjianyin/rank-anything/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
  //     { url: "https://xunjianyin.github.io/rank-anything/", img: "https://img.shields.io/badge/Website-Rank_Anything-blue" }
  //   ],
  //   isSelected: false,
  //   demoPath: "photos/project-demo/Rank-Anything.png"
  // },
  
];

// Helper functions to filter projects
const getSelectedProjects = () => projects.filter(project => project.isSelected);
const getAllProjects = () => projects;

// Research Experience Data
const researchExperience = [
  // {
  //   period: "June 2025 - Aug. 2025",
  //   institution: "Shanghai AI Lab",
  //   mentor: "Dr. Jie Fu",
  //   description: "Reinforcement Learning."
  // },
  {
    period: "June 2024 - February 2025",
    institution: "University of California, Santa Barbara (NLP Group)",
    mentor: "Prof. William Yang Wang",
    description: "<a href=\"https://arxiv.org/abs/2410.04444\">One paper</a> about Self-Referential Agent Framework; Ongoing work on reverse language model pre-training."
  },
  {
    period: "Feb. 2022 ~ Aug. 2022",
    institution: "Microsoft Research Asia (NLC Group)",
    mentor: "Dr. Shuming Ma and Dr. Kai Chen",
    description: "Pre-training with Curriculum Learning and OCR"
  },
  {
    period: "Oct. 2020 - June 2022",
    institution: "Wangxuan Institute of Computer Technology, Peking University",
    mentor: "Prof. Xiaojun Wan",
    description: "<a href=\"https://aclanthology.org/2022.acl-long.531.pdf\">One paper</a> at ACL 2022 on data-to-text generation"
  },
  {
    period: "Apr. 2020 - Nov. 2021",
    institution: "Institute of Computational Linguistics, Peking University",
    mentor: "Prof. Yunfang Wu",
    description: "Multi-Task Learning for Grammar Error Correction"
  },
  {
    period: "July 2019 - Dec. 2019",
    institution: "Institute of Computational Linguistics, Peking University",
    mentor: "Prof. Sujian Li",
    description: "Building Benchmark for Mathematical Olympiad Problems"
  }
];

// Teaching Data
const teaching = [
  "Teaching Assistant, Duke CS, Natural Language Processing, Spring 2026, with Prof. Bhuwan Dhingra",
  "Teaching Assistant, PKU EECS, Web Data Mining, Fall 2023, with Prof. Xiaojun Wan",
  "Teaching Assistant, PKU EECS, Introduction to Computing, Fall 2023, with Prof. Xifeng Deng",
  "Teaching Assistant, PKU EECS, Data Structures and Algorithms, Spring 2022, with Prof. Zhao Wang",
  "Teaching Assistant, PKU EECS, Introduction to Computing, Fall 2021, with Prof. Yibo Lin"
];

// Academic Services Data
const academicServices = [
  "Reviewer: ACL-ARR (2023 - Now), ICLR (2024 - 2026), NeurIPS (2024 - 2025), ICML (2025), AAAI (2024 - 2025),  COLM (2025), COLING (2024), JCST (2025)",
  "Volunteer: NLPCC 2023 Shared Task 8 track chair, AAAI 2024 volunteer, ACL 2024 volunteer"
];

// Talks Data
const talks = [
  {
    title: "Talk at JetBrains Seminar",
    venue: "JetBrains",
    date: "Sep 8, 2025",
    attachments: [
      { text: "Slides", url: "files/Talk at Jetbrains/slides.pdf", type: "pdf" },
      { text: "Blog", url: "https://xunjianyin.github.io/blog-post.html?id=self-referential-agent", type: "link" }
    ]
  },
  {
    title: "Speech at the Graduation Ceremony",
    venue: "Peking University",
    date: "Jun 26, 2025",
    attachments: [
      { text: "News", url: "https://mp.weixin.qq.com/s/fzxzfwheU-5rATVypjenwg", type: "link" },
      { text: "Slides", url: "files/Speech at the Graduation Ceremony/slides.pdf", type: "pdf" },
      { text: "Speech Draft", url: "files/Speech at the Graduation Ceremony/speech draft.pdf", type: "pdf" }
    ]
  },
  {
    title: "Talk at NICE",
    venue: "NICE Community",
    date: "Jun 14, 2025",
    attachments: [
      { text: "Slides", url: "files/Speech at NICE/slides.pdf", type: "pdf" },
      { text: "Video", url: "https://www.bilibili.com/video/BV16GNvzfE92", type: "video" }
    ]
  },
  {
    title: "Talk at the Founder Product Launch Event",
    venue: "Founder",
    date: "Jan 25, 2024",
    attachments: [
      { text: "News", url: "https://mp.weixin.qq.com/s/1LBHCS1GypM62GQWZ2VX9w", type: "link" }
    ]
  }

];

// Honors Data
const honors = [
  "Outstanding Graduate of Beijing, Jun. 2025",
  "Outstanding Graduate of Peking University, Jun. 2025",
  "Outstanding Master's Thesis Award of WICT, Peking University, Jun. 2025",
  "Merit Student, PKU, Sep. 2024",
  "Guotai Junan Scholarship, PKU, Sep. 2024",
  "Wang Xuan Scholarship, PKU, Sep. 2022",
  "Award for Research Excellence, PKU, Sep. 2023, 2022, 2021",
  "Award for Academic Excellence, PKU, Sep. 2020, 2019",
  "Outstanding Student, Shandong Province, Apr. 2018"
]; 
