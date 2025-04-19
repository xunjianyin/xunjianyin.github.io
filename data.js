// Preprints Data
const preprints = [
  {
    title: "Gödel Agent: A Self-Referential Agent Framework for Recursive Self-Improvement",
    authors: "<b>Xunjian Yin</b>, Xinyi Wang, Liangming Pan, Xiaojun Wan, William Yang Wang",
    venue: "ArXiv:2410",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2410.04444" },
      { text: "Code", url: "https://github.com/Arvid-pku/Godel_Agent" }
    ],
    isNew: true
  },
  {
    title: "ContraSolver: Self-Alignment of Language Models by Resolving Internal Preference Contradictions",
    authors: "Xu Zhang*, <b>Xunjian Yin</b>*, Xiaojun Wan",
    venue: "ArXiv:2406",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2406.08842" },
      { text: "Code", url: "https://github.com/Arvid-pku/ContraSolver" }
    ]
  }
];

// Full Publications list (for dedicated publications page)
const fullPublications = [
  {
    title: "Evaluating Self-Generated Documents for Enhancing Retrieval-Augmented Generation with LLMs",
    authors: "Jiatao Li, Xinyu Hu, <b>Xunjian Yin</b> and Xiaojun Wan",
    venue: "NAACL findings 2025",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2410.13192" }
    ],
    isNew: true
  },
  {
    title: "ChemAgent: Self-updating Memories in LLMs Improves Chemical Reasoning",
    authors: "Xiangru Tang, Tianyu Hu, Muyang Ye, Yanjun Shao, <b>Xunjian Yin</b>, Siru Ouyang, Wangchunshu Zhou, Pan Lu, <br>Zhuosheng Zhang, Yilun Zhao, Arman Cohan, Mark Gerstein",
    venue: "ICLR 2025",
    links: [
      { text: "Paper", url: "https://openreview.net/forum?id=kuhIqeVg0e" }
    ],
    isNew: true
  },
  {
    title: "DSGram: Dynamic Weighting Sub-Metrics for Grammatical Error Correction in the Era of Large Language Models",
    authors: "Jinxiang Xie, Yilin Li, <b>Xunjian Yin</b> (as Mentor), Xiaojun Wan",
    venue: "AAAI 2025",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/" },
      { text: "Code", url: "https://github.com/PKU-ONELab/" }
    ]
  },
  {
    title: "Themis: A Reference-free NLG Evaluation Language Model with Flexibility and Interpretability",
    authors: "Xinyu Hu, Li Lin, Mingqi Gao, <b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "EMNLP 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2406.18365" },
      { text: "Code", url: "https://github.com/PKU-ONELab/Themis" }
    ]
  },
  {
    title: "Benchmarking Knowledge Boundary for Large Language Model: A Different Perspective on Model Evaluation",
    authors: "<b>Xunjian Yin</b>, Xu Zhang*, Jie Ruan, Xiaojun Wan",
    venue: "ACL 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2402.11493" },
      { text: "Code", url: "https://github.com/pkulcwmzx/knowledge-boundary" }
    ]
  },
  {
    title: "History Matters: Temporal Knowledge Editing in Large Language Model",
    authors: "<b>Xunjian Yin</b>, Jin Jiang, Liming Yang, Xiaojun Wan",
    venue: "AAAI 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/pdf/2312.05497.pdf" },
      { text: "Code", url: "https://github.com/Arvid-pku/ATOKE" }
    ]
  },
  {
    title: "Error-Robust Retrieval for Chinese Spelling Check",
    authors: "<b>Xunjian Yin</b>, Xinyu Hu, Jin Jiang, Xiaojun Wan",
    venue: "COLING 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2312.05497" },
      { text: "Code", url: "https://github.com/PKU-ONELab/" }
    ]
  },
  {
    title: "ALCUNA: Large Language Models Meet New Knowledge",
    authors: "<b>Xunjian Yin</b>, Baizhou Huang*, Xiaojun Wan",
    venue: "EMNLP 2023",
    links: [
      { text: "Paper", url: "https://arxiv.org/pdf/2310.14820.pdf" },
      { text: "Code", url: "https://github.com/arvid-pku/alcuna" }
    ]
  },
  {
    title: "Exploring Context-Aware Evaluation Metrics for Machine Translation",
    authors: "Xinyu Hu, <b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "EMNLP 2023 Findings",
    links: [
      { text: "Paper", url: "TODO" },
      { text: "Code", url: "TODO" }
    ]
  },
  {
    title: "How Do Seq2Seq Models Perform on End-to-End Data-to-Text Generation?",
    authors: "<b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "ACL 2022",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2022.acl-long.531.pdf" },
      { text: "Code", url: "https://github.com/xunjianyin/Seq2SeqOnData2Text" }
    ]
  }
];

// Selected Publications Data - Removed DSGram paper
const selectedPublications = [
  {
    title: "Evaluating Self-Generated Documents for Enhancing Retrieval-Augmented Generation with LLMs",
    authors: "Jiatao Li, Xinyu Hu, <b>Xunjian Yin</b> and Xiaojun Wan",
    venue: "NAACL findings 2025",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2410.13192" }
    ],
    isNew: true
  },
  {
    title: "ChemAgent: Self-updating Memories in LLMs Improves Chemical Reasoning",
    authors: "Xiangru Tang, Tianyu Hu, Muyang Ye, Yanjun Shao, <b>Xunjian Yin</b>, Siru Ouyang, Wangchunshu Zhou, Pan Lu, <br>Zhuosheng Zhang, Yilun Zhao, Arman Cohan, Mark Gerstein",
    venue: "ICLR 2025",
    links: [
      { text: "Paper", url: "https://openreview.net/forum?id=kuhIqeVg0e" }
    ],
    isNew: true
  },
  {
    title: "Themis: A Reference-free NLG Evaluation Language Model with Flexibility and Interpretability",
    authors: "Xinyu Hu, Li Lin, Mingqi Gao, <b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "EMNLP 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2406.18365" },
      { text: "Code", url: "https://github.com/PKU-ONELab/Themis" }
    ]
  },
  {
    title: "Benchmarking Knowledge Boundary for Large Language Model: A Different Perspective on Model Evaluation",
    authors: "<b>Xunjian Yin</b>, Xu Zhang*, Jie Ruan, Xiaojun Wan",
    venue: "ACL 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2402.11493" },
      { text: "Code", url: "https://github.com/pkulcwmzx/knowledge-boundary" }
    ]
  },
  {
    title: "History Matters: Temporal Knowledge Editing in Large Language Model",
    authors: "<b>Xunjian Yin</b>, Jin Jiang, Liming Yang, Xiaojun Wan",
    venue: "AAAI 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/pdf/2312.05497.pdf" },
      { text: "Code", url: "https://github.com/Arvid-pku/ATOKE" }
    ]
  },
  {
    title: "Error-Robust Retrieval for Chinese Spelling Check",
    authors: "<b>Xunjian Yin</b>, Xinyu Hu, Jin Jiang, Xiaojun Wan",
    venue: "COLING 2024",
    links: [
      { text: "Paper", url: "https://arxiv.org/abs/2312.05497" },
      { text: "Code", url: "https://github.com/PKU-ONELab/" }
    ]
  },
  {
    title: "ALCUNA: Large Language Models Meet New Knowledge",
    authors: "<b>Xunjian Yin</b>, Baizhou Huang*, Xiaojun Wan",
    venue: "EMNLP 2023",
    links: [
      { text: "Paper", url: "https://arxiv.org/pdf/2310.14820.pdf" },
      { text: "Code", url: "https://github.com/arvid-pku/alcuna" }
    ]
  },
  {
    title: "Exploring Context-Aware Evaluation Metrics for Machine Translation",
    authors: "Xinyu Hu, <b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "EMNLP 2023 Findings",
    links: [
      { text: "Paper", url: "TODO" },
      { text: "Code", url: "TODO" }
    ]
  },
  {
    title: "How Do Seq2Seq Models Perform on End-to-End Data-to-Text Generation?",
    authors: "<b>Xunjian Yin</b>, Xiaojun Wan",
    venue: "ACL 2022",
    links: [
      { text: "Paper", url: "https://aclanthology.org/2022.acl-long.531.pdf" },
      { text: "Code", url: "https://github.com/xunjianyin/Seq2SeqOnData2Text" }
    ]
  }
];

// Projects Data
const projects = [
  {
    title: "Overleaf-Bib-Helper",
    description: "A UserScript to enhance Overleaf by allowing article searches and BibTeX retrieval from DBLP and Google Scholar <br>directly within the Overleaf editor. (<a href=\"https://github.com/MLNLP-World/Overleaf-Bib-Helper\">Repo</a>)",
    badges: [
      { url: "https://greasyfork.org/zh-CN/scripts/532304-overleaf-bib-helper", img: "https://img.shields.io/badge/Install-Greasy_Fork-blue" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/releases", img: "https://img.shields.io/badge/Version-1.3-blue" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/blob/main/LICENSE.md", img: "https://img.shields.io/badge/License-MIT-blue" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/stargazers", img: "https://img.shields.io/github/stars/MLNLP-World/Overleaf-Bib-Helper" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/network/members", img: "https://img.shields.io/github/forks/MLNLP-World/Overleaf-Bib-Helper" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/issues", img: "https://img.shields.io/github/issues/MLNLP-World/Overleaf-Bib-Helper" },
      { url: "https://github.com/MLNLP-World/Overleaf-Bib-Helper/pulls", img: "https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" }
    ]
  }
];

// Research Experience Data
const researchExperience = [
  {
    period: "June 2024 - February 2025",
    institution: "University of California, Santa Barbara (NLP Group)",
    mentor: "Prof. William Wang",
    description: "<a href=\"https://arxiv.org/abs/2410.04444\">One paper</a> about Self-Referential Agent Framework; Ongoing work on reverse language model pre-training."
  },
  {
    period: "Feb. 2022 - Aug. 2022",
    institution: "Microsoft Research Asia (NLC Group)",
    mentor: "Dr. Shuming Ma",
    description: "Pre-training with Curriculum Learning"
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
  "Merit Student, PKU, Sep. 2024",
  "Guotai Junan Scholarship, PKU, Sep. 2024",
  "Wang Xuan Scholarship, PKU, Sep. 2022",
  "Award for Research Excellence, PKU, Sep. 2023, 2022, 2021",
  "Award for Academic Excellence, PKU, Sep. 2020, 2019",
  "Outstanding Student, Shandong Province, Apr. 2018"
]; 