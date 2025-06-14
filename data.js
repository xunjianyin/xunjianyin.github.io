// Unified Publications Data
const publications = [
  // Preprints
  {
    title: "ContraSolver: Self-Alignment of Language Models by Resolving Internal Preference Contradictions",
    authors: "Xu Zhang*, <b>Xunjian Yin</b>*, Xiaojun Wan",
    venue: "ArXiv:2406",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2406.08842" },
      { text: "Code", url: "https://github.com/Arvid-pku/ContraSolver" }
    ],
    isPreprint: true,
    isSelected: true
  },
  
  // Publications
  {
    title: "Gödel Agent: A Self-Referential Agent Framework for Recursive Self-Improvement",
    authors: "<b>Xunjian Yin</b>, Xinyi Wang, Liangming Pan, Xiaojun Wan, William Yang Wang",
    venue: "ACL 2025",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2410.04444" },
      { text: "Code", url: "https://github.com/Arvid-pku/Godel_Agent" }
    ],
    isNew: true,
    isPreprint: false,
    isSelected: true
  },
  {
    title: "MC-MKE: A Fine-Grained Multimodal Knowledge Editing Benchmark Emphasizing Modality Consistency",
    authors: "Junzhe Zhang, Huixuan Zhang, <b>Xunjian Yin</b>, Baizhou Huang, Xu Zhang, Xinyu Hu, Xiaojun Wan",
    venue: "ACL Findings 2025",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2406.13219" },
    ],
    isNew: true,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "LLM-based NLG Evaluation: Current Status and Challenges",
    authors: "Mingqi Gao, Xinyu Hu, <b>Xunjian Yin</b>, Jie Ruan, Xiao Pu, Xiaojun Wan",
    venue: "Computational Linguistics 2025",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2402.01383" },
    ],
    isNew: true,
    isPreprint: false,
    isSelected: false
  },
  {
    title: "Evaluating Self-Generated Documents for Enhancing Retrieval-Augmented Generation with LLMs",
    authors: "Jiatao Li, Xinyu Hu, <b>Xunjian Yin</b> and Xiaojun Wan",
    venue: "NAACL findings 2025",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2410.13192" },
      { text: "Code", url: "https://github.com/leejamesss/Eval_Self_Docs_RAG" }
    ],
    isPreprint: false,
    isSelected: false
  },
  {
    title: "ChemAgent: Self-updating Memories in LLMs Improves Chemical Reasoning",
    authors: "Xiangru Tang, Tianyu Hu, Muyang Ye, Yanjun Shao, <b>Xunjian Yin</b>, Siru Ouyang, Wangchunshu Zhou, Pan Lu, <br>Zhuosheng Zhang, Yilun Zhao, Arman Cohan, Mark Gerstein",
    venue: "ICLR 2025",
    links: [
      { text: "Paper", url: "https://openreview.net/forum?id=kuhIqeVg0e" },
      { text: "Code", url: "https://github.com/gersteinlab/chemagent" }
    ],
    isPreprint: false,
    isSelected: true
  },
  {
    title: "DSGram: Dynamic Weighting Sub-Metrics for Grammatical Error Correction in the Era of Large Language Models",
    authors: "Jinxiang Xie, Yilin Li, <b>Xunjian Yin</b> (as Mentor), Xiaojun Wan",
    venue: "AAAI 2025",
    links: [
      { text: "Paper", url: "https://ojs.aaai.org/index.php/AAAI/article/view/34746/36901" },
      { text: "Code", url: "https://github.com/PKU-ONELab/" }
    ],
    isPreprint: false,
    isSelected: false
  },
  {
    title: "Themis: A Reference-free NLG Evaluation Language Model with Flexibility and Interpretability",
    authors: "Xinyu Hu, Li Lin, Mingqi Gao, <b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "EMNLP 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2406.18365" },
      { text: "Code", url: "https://github.com/PKU-ONELab/Themis" }
    ],
    isPreprint: false,
    isSelected: true
  },
  {
    title: "Benchmarking Knowledge Boundary for Large Language Model: A Different Perspective on Model Evaluation",
    authors: "<b>Xunjian Yin</b>, Xu Zhang*, Jie Ruan, Xiaojun Wan",
    venue: "ACL 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2402.11493" },
      { text: "Code", url: "https://github.com/pkulcwmzx/knowledge-boundary" }
    ],
    isPreprint: false,
    isSelected: true
  },
  {
    title: "History Matters: Temporal Knowledge Editing in Large Language Model",
    authors: "<b>Xunjian Yin</b>, Jin Jiang, Liming Yang, Xiaojun Wan",
    venue: "AAAI 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/pdf/2312.05497.pdf" },
      { text: "Code", url: "https://github.com/Arvid-pku/ATOKE" }
    ],
    isPreprint: false,
    isSelected: true
  },
  {
    title: "Error-Robust Retrieval for Chinese Spelling Check",
    authors: "<b>Xunjian Yin</b>, Xinyu Hu, Jin Jiang, Xiaojun Wan",
    venue: "COLING 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2312.05497" },
      { text: "Code", url: "https://github.com/PKU-ONELab/" }
    ],
    isPreprint: false,
    isSelected: false
  },
  {
    title: "Contextual Modeling for Document-level ASR Error Correction",
    authors: "Jin Jiang, <b>Xunjian Yin</b>, Xiaojun Wan, Wei Peng, Rongjun Li, Jingyuan Yang, and Yanquan Zhou",
    venue: "COLING 2024",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2024.lrec-main.341/" },
      { text: "Code", url: "https://github.com/jiangjin1999/context_ASR" }
    ],
    isPreprint: false,
    isSelected: false
  },
  {
    title: "ALCUNA: Large Language Models Meet New Knowledge",
    authors: "<b>Xunjian Yin</b>, Baizhou Huang*, Xiaojun Wan",
    venue: "EMNLP 2023",
    links: [
      { text: "Paper", url: "https://arxiv.org/pdf/2310.14820.pdf" },
      { text: "Code", url: "https://github.com/arvid-pku/alcuna" }
    ],
    isPreprint: false,
    isSelected: true
  },
  {
    title: "Exploring Context-Aware Evaluation Metrics for Machine Translation",
    authors: "Xinyu Hu, <b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "EMNLP 2023 Findings",
    links: [
      { text: "Paper", url: "TODO" },
      { text: "Code", url: "TODO" }
    ],
    isPreprint: false,
    isSelected: false
  },
  {
    title: "How Do Seq2Seq Models Perform on End-to-End Data-to-Text Generation?",
    authors: "<b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "ACL 2022",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2022.acl-long.531.pdf" },
      { text: "Code", url: "https://github.com/xunjianyin/Seq2SeqOnData2Text" }
    ],
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
    description: "A UserScript to enhance Overleaf by allowing article searches and BibTeX retrieval from DBLP and Google Scholar <br>directly within the Overleaf editor. (<a href=\"https://github.com/MLNLP-World/Overleaf-Bib-Helper\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/releases", img: "https://img.shields.io/badge/Version-1.3-blue" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/stargazers", img: "https://img.shields.io/github/stars/MLNLP-World/Overleaf-Bib-Helper" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/network/members", img: "https://img.shields.io/github/forks/MLNLP-World/Overleaf-Bib-Helper" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/issues", img: "https://img.shields.io/github/issues/MLNLP-World/Overleaf-Bib-Helper" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
      { url: "https://greasyfork.org/zh-CN/scripts/532304-overleaf-bib-helper", img: "https://img.shields.io/badge/Install-Greasy_Fork-blue" }
    ],
    isSelected: true
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
    isSelected: true
  },
  {
    title: "Overleaf-Bib-Helper-Dev",
    description: "A UserScript to enhance Overleaf by allowing article searches and BibTeX retrieval from DBLP and Google Scholar <br>directly within the Overleaf editor. (<a href=\"https://github.com/Arvid-pku/Overleaf-Bib-Helper\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/releases", img: "https://img.shields.io/badge/Version-1.3-blue" },
      { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/stargazers", img: "https://img.shields.io/github/stars/Arvid-pku/Overleaf-Bib-Helper" },
      { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/network/members", img: "https://img.shields.io/github/forks/Arvid-pku/Overleaf-Bib-Helper" },
      { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/issues", img: "https://img.shields.io/github/issues/Arvid-pku/Overleaf-Bib-Helper" },
      { url: "https://github.com/Arvid-pku/Overleaf-Bib-Helper/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
      { url: "https://greasyfork.org/zh-CN/scripts/532304-overleaf-bib-helper", img: "https://img.shields.io/badge/Install-Greasy_Fork-blue" }
    ],
    isSelected: false
  },
  {
    title: "Bouncing Ball",
    description: "A website to play with a ball (developing). (<a href=\"https://xunjianyin.github.io/bouncing-ball-animation/\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/stargazers", img: "https://img.shields.io/github/stars/xunjianyin/bouncing-ball-animation" },
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/network/members", img: "https://img.shields.io/github/forks/xunjianyin/bouncing-ball-animation" },
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/issues", img: "https://img.shields.io/github/issues/xunjianyin/bouncing-ball-animation" },
      { url: "https://github.com/xunjianyin/bouncing-ball-animation/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
      { url: "https://xunjianyin.github.io/bouncing-ball-animation/", img: "https://img.shields.io/badge/Website-Bouncing_Ball-blue" }
    ],
  },
  {
    title: "Rank-Anything",
    description: "A website to rank anything (developing). (<a href=\"https://xunjianyin.github.io/rank-anything/\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/xunjianyin/rank-anything/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/xunjianyin/rank-anything/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/xunjianyin/rank-anything/stargazers", img: "https://img.shields.io/github/stars/xunjianyin/rank-anything" },
      { url: "https://github.com/xunjianyin/rank-anything/network/members", img: "https://img.shields.io/github/forks/xunjianyin/rank-anything" },
      { url: "https://github.com/xunjianyin/rank-anything/issues", img: "https://img.shields.io/github/issues/xunjianyin/rank-anything" },
      { url: "https://github.com/xunjianyin/rank-anything/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
      { url: "https://xunjianyin.github.io/rank-anything/", img: "https://img.shields.io/badge/Website-Rank_Anything-blue" }
    ],
    isSelected: false
  },
  {
    title: "Star-Maker",
    description: "A website to create and explore planetary systems (developing). (<a href=\"https://xunjianyin.github.io/star-maker/\">Project Homepage</a>)",
    badges: [
      { url: "https://github.com/xunjianyin/star-maker/releases", img: "https://img.shields.io/badge/Version-1.0-blue" },
      { url: "https://github.com/xunjianyin/star-maker/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/xunjianyin/star-maker/stargazers", img: "https://img.shields.io/github/stars/xunjianyin/star-maker" },
      { url: "https://github.com/xunjianyin/star-maker/network/members", img: "https://img.shields.io/github/forks/xunjianyin/star-maker" },
      { url: "https://github.com/xunjianyin/star-maker/issues", img: "https://img.shields.io/github/issues/xunjianyin/star-maker" },
      { url: "https://github.com/xunjianyin/star-maker/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" },
      { url: "https://xunjianyin.github.io/star-maker/", img: "https://img.shields.io/badge/Website-Star_Maker-blue" }
    ],
    isSelected: false
  }
];

// Helper functions to filter projects
const getSelectedProjects = () => projects.filter(project => project.isSelected);
const getAllProjects = () => projects;

// Research Experience Data
const researchExperience = [
  {
    period: "June 2025 - Current",
    institution: "Shanghai AI Lab",
    mentor: "Dr. Jie Fu",
    description: "Reinforcement Learning."
  },
  {
    period: "June 2024 - February 2025",
    institution: "University of California, Santa Barbara (NLP Group)",
    mentor: "Prof. William Yang Wang",
    description: "<a href=\"https://arxiv.org/abs/2410.04444\">One paper</a> about Self-Referential Agent Framework; Ongoing work on reverse language model pre-training."
  },
  {
    period: "Feb. 2022 ~ Aug. 2022",
    institution: "Microsoft Research Asia (NLC Group)",
    mentor: "Dr. Kai Chen and Dr. Shuming Ma",
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
  "Teaching Assistant, PKU CS, Web Data Mining, Fall 2023, with Prof. Xiaojun Wan",
  "Teaching Assistant, PKU CS, Introduction to Computing, Fall 2023, with Prof. Xifeng Deng",
  "Teaching Assistant, PKU CS, Data Structures and Algorithms, Spring 2022, with Prof. Zhao Wang",
  "Teaching Assistant, PKU CS, Introduction to Computing, Fall 2021, with Prof. Yibo Lin"
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