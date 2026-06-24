// ── Syllabus Data ────────────────────────────────────────────────────────────
// Ported from old app js/app.js — single source of truth for all topic lists.

export interface SyllabusSection {
  key: string;          // prefix used in checkbox IDs: uid-{key}-{idx}
  label: string;
  topics: string[];
}

export interface SyllabusStage {
  id: string;
  label: string;
  sections: SyllabusSection[];
}

// ── Prelims ──────────────────────────────────────────────────────────────────
const dataP1: string[] = [
  "Current Events: Current events of national and international importance.",
  "History of India and Indian National Movement: Social, economic, and political aspects of ancient, medieval, and modern Indian history; structural phases of the national freedom struggle.",
  "Indian and World Geography: Physical, social, and economic geography of India and the global domains.",
  "Indian Polity and Governance: Constitution, political system, Panchayati Raj, public policy, rights issues, statutory frameworks, and structural governance architectures.",
  "Economic and Social Development: Sustainable development, poverty inclusion dynamics, demographics, social sector initiatives, fiscal policies, and macroeconomic foundations.",
  "General Issues on Environmental Ecology, Bio-diversity, and Climate Change: Global environmental challenges, conservation paradigms, ecosystem parameters (that do not require specialized academic domain expertise).",
  "General Science: Foundational scientific vectors encompassing physics, chemistry, biology, and contemporary technological advancements.",
];

const dataP2: string[] = [
  "Comprehension frameworks and contextual textual interpretation analytical streams.",
  "Interpersonal skills including comprehensive communication architectures.",
  "Logical reasoning and analytical capability domains.",
  "Decision-making mechanics and problem-solving scenarios.",
  "General mental ability parameters.",
  "Basic Numeracy: Numbers and their relations, orders of magnitude, etc. (Class X level data matrices).",
  "Data Interpretation: Charts, graphs, tables, data sufficiency profiles (Class X level presentation matrices).",
];

// ── Mains ────────────────────────────────────────────────────────────────────
const dataGS1: string[] = [
  "Indian Culture shall cover the salient aspects of Art Forms, Literature and Architecture from Ancient to Modern times.",
  "Modern Indian History from about the middle of the eighteenth century until the present- significant events, personalities, issues.",
  "The Freedom Struggle its various stages and important contributors/contributions from different parts of the country.",
  "Post-independence consolidation and reorganization within the country.",
  "History of the World shall include events from 18th century such as Industrial Revolution, world wars, redrawal of national boundaries, colonization, decolonization, political philosophies like communism, capitalism, socialism etc. their forms and effect on the society.",
  "Salient features of Indian Society, Diversity of India.",
  "Role of women and women's organization, population and associated issues, poverty and developmental issues, urbanization, their problems and their remedies.",
  "Effects of globalization on Indian society.",
  "Social empowerment, communalism, regionalism & secularism.",
  "Salient features of world's physical geography.",
  "Distribution of key natural resources across the world (including South Asia and the Indian sub-continent).",
  "Important Geophysical phenomena such as earthquakes, Tsunami, Volcanic activity, cyclone etc., geographical features and their location-changes in critical geographical features (including water-bodies and ice-caps) and in flora and fauna and the effects of such changes.",
];

const dataGS2: string[] = [
  "Indian Constitution-historical underpinnings, evolution, features, amendments, significant provisions and basic structure.",
  "Functions and responsibilities of the Union and the States, issues and challenges pertaining to the federal structure, devolution of powers and finances up to local levels and challenges therein.",
  "Separation of powers between various organs dispute redressal mechanisms and institutions.",
  "Comparison of the Indian constitutional scheme with that of other countries.",
  "Parliament and State Legislatures-structure, functioning, conduct of business, powers & privileges and issues arising out of these.",
  "Structure, organization and functioning of the Executive and the Judiciary-Ministries and Departments of the Government; pressure groups and formal/informal associations and their role in the Polity.",
  "Salient features of the Representation of People's Act.",
  "Appointment to various Constitutional posts, powers, functions and responsibilities of various Constitutional Bodies.",
  "Statutory, regulatory and various quasi-judicial bodies.",
  "Government policies and interventions for development in various sectors and issues arising out of their design and implementation.",
  "Development processes and the development industry-the role of NGOs, SHGs, various groups and associations, donors, charities, institutional and other stakeholders.",
  "Welfare schemes for vulnerable sections of the population by the Centre and States and the performance of these schemes.",
  "Issues relating to development and management of Social Sector/Services relating to Health, Education, Human Resources.",
  "Issues relating to poverty and hunger.",
  "Important aspects of governance, transparency and accountability, e-governance-applications, models, successes, limitations, and potential; citizens charters, transparency & accountability and institutional and other measures.",
  "Role of civil services in a democracy.",
  "India and its neighborhood-relations.",
  "Bilateral, regional and global groupings and agreements involving India and/or affecting India's interests.",
  "Effect of policies and politics of developed and developing countries on India's interests, Indian diaspora.",
  "Important International institutions, agencies and fora-their structure, mandate.",
];

const dataGS3: string[] = [
  "Indian Economy and issues relating to planning, mobilization of resources, growth, development and employment.",
  "Inclusive growth and issues arising from it.",
  "Government Budgeting.",
  "Major crops-cropping patterns in various parts of the country, different types of irrigation and irrigation systems storage, transport and marketing of agricultural produce and issues and related constraints; e-technology in the aid of farmers.",
  "Issues related to direct and indirect farm subsidies and minimum support prices; Public Distribution System-objectives, functioning, limitations, revamping; issues of buffer stocks and food security; Technology missions; economics of animal-rearing.",
  "Food processing and related industries in India-scope and significance, location, upstream and downstream requirements, supply chain management.",
  "Land reforms in India.",
  "Effects of liberalization on the economy, changes in industrial policy and their effects on industrial growth.",
  "Infrastructure: Energy, Ports, Roads, Airports, Railways etc.",
  "Investment models.",
  "Science and Technology-developments and their applications and effects in everyday life.",
  "Achievements of Indians in science & technology; indigenization of technology and developing new technology.",
  "Awareness in the fields of IT, Space, Computers, Robotics, Nano-technology, Bio-technology and issues relating to intellectual property rights.",
  "Conservation, environmental pollution and degradation, environmental impact assessment.",
  "Disaster and disaster management.",
  "Linkages between development and spread of extremism.",
  "Role of external state and non-state actors in creating challenges to internal security.",
  "Challenges to internal security through communication networks, role of media and social networking sites in internal security challenges, basics of cyber security; money-laundering and its prevention.",
  "Security challenges and their management in border areas-linkages of organized crime with terrorism.",
  "Various Security forces and agencies and their mandate.",
];

const dataGS4: string[] = [
  "Ethics and Human Interface: Essence, determinants and consequences of Ethics in human actions; dimensions of ethics; ethics in private and public relationships. Human Values-lessons from the lives and teachings of great leaders, reformers and administrators; role of family, society and educational institutions in imparting values.",
  "Attitude: Content, structure, function; its influence and relation with thought and behaviour; moral and political attitudes; social influence and persuasion.",
  "Aptitude: Aptitude and foundational values for Civil Service, integrity, impartiality and non-partisanship, objectivity, dedication to public service, empathy, tolerance and compassion towards the weaker-sections.",
  "Emotional Intelligence: Concepts, and their utilities and application in administration and governance.",
  "Contributions of Moral Thinkers: Contributions of moral thinkers and philosophers from India and world.",
  "Public/Civil Service Values and Ethics in Public Administration: Status and problems; ethical concerns and dilemmas in government and private institutions; laws, rules, regulations and conscience as sources of ethical guidance; accountability and ethical governance; strengthening of ethical and moral values in governance; ethical issues in international relations and funding; corporate governance.",
  "Probity in Governance: Concept of public service; Philosophical basis of governance and probity; Information sharing and transparency in government, Right to Information, Codes of Ethics, Codes of Conduct, Citizen's Charters, Work culture, Quality of service delivery, Utilization of public funds, challenges of corruption.",
  "Case Studies on above issues.",
];

const dataES: string[] = [
  "Candidates shall be required to write essays on multiple topics. They will be expected to keep close to the subject of the essay to arrange their ideas in an orderly fashion and to write concisely. Credit will be given for effective and exact expression.",
];

const dataLA: string[] = [
  "One of the Indian languages to be selected by the candidate from the Languages included in the Eighth Schedule to the Constitution.",
];

const dataLB: string[] = [
  "English Language competence, text composition, precis mechanics, and general vocabulary expression.",
];

// ── Anthropology ─────────────────────────────────────────────────────────────
const dataA1: string[] = [
  "1.1 Meaning, Scope and Development of Anthropology.",
  "1.2 Relationships with other disciplines: Social Sciences, Behavioural Sciences, Life Sciences, Medical Sciences, Earth Sciences and Humanities.",
  "1.3 Main branches of Anthropology, their scope and relevance: (a) Social-cultural Anthropology. (b) Biological Anthropology. (c) Archaeological Anthropology. (d) Linguistic Anthropology.",
  "1.4 Human Evolution and emergence of Man: (a) Biological and Cultural factors in human evolution. (b) Theories of Organic Evolution (Pre-Darwinian, Darwinian and Post-Darwinian). (c) Synthetic theory of evolution; Brief outline of terms and concepts of evolutionary biology (Doll's rule, Cope's rule, Gause's rule, parallelism, convergence, adaptive radiation, and mosaic evolution).",
  "1.5 Characteristics of Primates; Evolutionary Trend and Primate Taxonomy; Primate Adaptations; (Arboreal and Terrestrial) Primate Behaviour; Tertiary and Quaternary fossil primates; Living Major Primates; Comparative Anatomy of Man and Apes; Skeletal changes due to erect posture and bipedalism.",
  "1.6 Phylogenetic status, characteristics and geographical distribution of the following: (a) Plio-pleistocene hominids in South and East Africa - Australopithecines. (b) Homo erectus: Africa (Homo ergaster), Europe (Homo heidelbergensis), Asia (Homo erectus pekinensis, Homo erectus javanicus). (c) Neanderthal Man - La-Chapelle-aux-Saints (Classical type), Mt. Carmel (Progressive type). (d) Rhodesian man. (e) Homo sapiens Cro-Magnon, Grimaldi and Chancelade.",
  "1.7 The biological basis of Life: Cell, DNA structure and replication, Protein Synthesis, Gene, Mutation, Chromosomes, and Cell Division.",
  "1.8 Principles of Prehistoric Archaeology: Chronology: Relative and Absolute dating methods. Cultural Evolution-Broad Outlines of Prehistoric cultures: (a) Paleolithic (b) Mesolithic (c) Neolithic (d) Chalcolithic (e) Copper-Bronze Age (f) Iron Age.",
  "2.1 The Nature of Culture: The concept and characteristics of culture and civilization; Ethnocentrism vis-a-vis cultural Relativism.",
  "2.2 Society: Concept of Society; Society and Culture; Social Institutions; Social Groups; Social stratification.",
  "2.3 Marriage: Definition and universality; Laws of marriage (endogamy, exogamy, hypergamy, hypogamy); Types of marriage (monogamy, polygamy, polyandry, group marriage). Functions of marriage; Marriage regulations (preferential, prescriptive and proscriptive); Marriage payments (bride wealth and dowry).",
  "2.4 Family: Definition and universality; Family, household and domestic groups; Functions of family; Types of family (from the perspectives of structure, blood relation, marriage, residence and succession); Impact of urbanization, industrialization and feminist movements on family.",
  "2.5 Kinship: Consanguinity and Affinity; Principles of Descent (Unilineal, Double, Bilateral, Ambilineal); Forms of descent groups (lineage, clan, phratry, moiety and kindred); Kinship terminology (descriptive and classificatory); Alliance and Descent.",
  "3.1 Economic Anthropology: Meaning, scope and relevance; Formalist and Substantivist debate; Exchange: Forms of exchange-Loss, barter, trade, reciprocity (generalized, balanced and negative) and redistribution; Spheres of exchange; Kula ring; Ceremonial exchange.",
  "3.2 Political Anthropology: Band, tribe, chiefdom, kingdom and state; concepts of power, authority and legitimacy; Social control, law and justice in simple societies.",
  "3.3 Religion: Anthropological approaches to the study of religion (evolutionary, psychological and functional); Monotheism and polytheism; Sacred and profane; Myths and rituals; Forms of religion in tribal and peasant Societies (Animism, Animatism, Fetishism, Naturism and Totemism); Religion, magic and science distinguished; Magico-religious functionaries (Priest, Shaman, Medicine man, Sorcerer and Witch).",
  "3.4 Anthropological theories: (i) Classical Evolutionism (Tylor, Morgan) (ii) Neo-Evolutionism (White, Steward, Sahlins) (iii) Historical Particularism (Boas); Diffusionism (British, German, American) (iv) Functionalism (Malinowski); Structural-Functionalism (Radcliffe-Brown) (v) Structuralism (Levi-Strauss and Edmund Leach) (vi) Culture and Personality (Benedict, Mead, Linton, Kardiner) (vii) Neo-materialism (Harris) (viii) Symbolic and Interpretive theories (Turner, Geertz) (ix) Cognitive theories (Tyler, Conklin) (x) Post-Modernism in Anthropology.",
  "4.1 Biological Anthropology: Human Genetics-Methods and Principles; Decoding the Biological Basis: DNA Structure, Function and Replication; Protein Synthesis; Mendel's Laws; Concept of gene; Mutations: Genic and Chromosomal; Inheritance: Autosomal, Sex-linked, Polygenic; Genetic Analysis: Pedigree Analysis, Hardy-Weinberg Law; Human Karyotype.",
  "4.2 Concept of race in biological anthropology; Racial criteria: Morphological and genetic; Racial classification: Hooton, Coon, Garn and Birdsell; Concept of ethnic group and racism; UNESCO statement on race; Racial traits: pigmentation, hair, eye, nose, body build and ABO, Rh blood groups; Adaptive significance of skin colour. Bio-cultural adaptations: Sickle cell trait, Lactose tolerance.",
  "4.3 Concept of growth and development: stages of growth-Loss prenatal, natal, infant, childhood, adolescence, maturity, senescence; Factors affecting growth and development: genetic, environmental, nutritional and hormonal; Growth curve; Secular trend in growth and nutrition; Human physique and somatotypes; Menarcheal age and its variation; Human Ecology and its relevance.",
  "4.4 Demographic Anthropology: Demographic theories-Loss Biological, Social and Cultural; Demographic profiles of Indian tribes; Biological and socio-ecological factors of fertility; Measures of morbidity and mortality.",
  "4.5 Applications of Anthropology: Forensic Anthropology, Medical Anthropology, Ergonomics, Applied Human Genetics (Genetic Counselling, DNA Fingerprinting, Gene Therapy).",
];

const dataA2: string[] = [
  "1.1 Evolution of the Indian Culture and Civilization: Prehistoric (Paleolithic, Mesolithic, Neolithic and Chalcolithic); Protohistoric (Indus Valley Civilization); Islamic impacts; Westernization and Modernization trends.",
  "1.2 Paleoanthropological evidences from India with special reference to Ramapithecus, Sivapithecus and Narmada Man.",
  "1.3 Ethno-archaeology in India: The concept of ethno-archaeology; Survivals and Parallels among the hunter-gatherers, pastoralists, nomadic communities, agriculturalists and artisan communities.",
  "2. Demographic profile of India: Ethnic and linguistic elements in the Indian population and their distribution; Social and economic characteristics of the ethnographic elements.",
  "3.1 The structure and nature of traditional Indian social system: Varnashrama, Purushartha, Karma, Rina and Rebirth concepts.",
  "3.2 Caste system in India: Structure and characteristics; Varna and Caste; Theories of origin of caste system; Dominant Caste; Caste mobility; Future of caste system; Jajmani system; Jati Panchayat.",
  "3.3 Sacred Complex and Nature-Man-Spirit Complex.",
  "3.4 Impact of Buddhism, Jainism, Islam and Christianity on Indian society.",
  "4. Emergence and Growth of Anthropology in India: Contributions of the 18th, 19th and early 20th Century scholar-administrators; Contributions of Indian anthropologists to tribal and peasant studies.",
  "5.1 Indian Village: Significance of village study in India; Indian village as a social system; Traditional and changing patterns of settlement and inter-caste relations; Agrarian relations in Indian villages; Impact of globalization on Indian villages.",
  "5.2 Linguistic and religious minorities and their social, political and economic problems.",
  "5.3 Indigenous and exogenous processes of socio-cultural change in Indian society: Sanskritization, Westernization, Modernization; Inter-play of Little and Great Traditions; Panchayati Raj and social change.",
  "6.1 Tribal situation in India: Bio-genetic variability, linguistic and socio-economic characteristics of tribal populations and their distribution.",
  "6.2 Problems of tribal communities: land alienation, poverty, indebtedness, low literacy, inadequate health care, drug abuse, alcoholism, exploitation and cultural impact of urbanization and industrialization on tribal populations.",
  "6.3 Developmental projects and tribal displacement and rehabilitation-Loss Development of forest policy and its impact on tribal populations; Concept of Ethnodevelopment; Tribal Development strategies in India-5 Year Plans, and Tribal Sub-Plans.",
  "6.4 Constitutional Safeguards for Scheduled Tribes: Role of Anthropology in Tribal and Rural Development; Contributions of N.K. Bose, Verrier Elwin, S.C. Roy; The concept of Primitive Tribal Groups (PTGs); The role of NGOs.",
];

// ── Current Affairs ──────────────────────────────────────────────────────────
const dataCA: string[] = [
  "May 2026 Monthly Compilation", "June 2026 Monthly Compilation",
  "July 2026 Monthly Compilation", "August 2026 Monthly Compilation",
  "September 2026 Monthly Compilation", "October 2026 Monthly Compilation",
  "November 2026 Monthly Compilation", "December 2026 Monthly Compilation",
  "January 2027 Monthly Compilation", "February 2027 Monthly Compilation",
  "March 2027 Monthly Compilation", "April 2027 Monthly Compilation",
  "May 2027 (Pre-Exam Update)",
];

// ── Assembled Stages ─────────────────────────────────────────────────────────
export const STAGES: SyllabusStage[] = [
  {
    id: 'prelims',
    label: 'Stage I: Prelims',
    sections: [
      { key: 'p1', label: 'GS Paper I', topics: dataP1 },
      { key: 'p2', label: 'CSAT Paper II', topics: dataP2 },
    ],
  },
  {
    id: 'mains',
    label: 'Stage II: Mains',
    sections: [
      { key: 'la', label: 'Language A (Qualifying)', topics: dataLA },
      { key: 'lb', label: 'Language B — English (Qualifying)', topics: dataLB },
      { key: 'es', label: 'Essay', topics: dataES },
      { key: 'gs1', label: 'GS Paper I', topics: dataGS1 },
      { key: 'gs2', label: 'GS Paper II', topics: dataGS2 },
      { key: 'gs3', label: 'GS Paper III', topics: dataGS3 },
      { key: 'gs4', label: 'GS Paper IV — Ethics', topics: dataGS4 },
    ],
  },
  {
    id: 'anthro',
    label: 'Stage III: Optional',
    sections: [
      { key: 'a1', label: 'Paper I', topics: dataA1 },
      { key: 'a2', label: 'Paper II', topics: dataA2 },
    ],
  },
];

export const CA_SECTION: SyllabusSection = { key: 'ca', label: 'Current Affairs', topics: dataCA };

// ── Pie/Progress colors ──────────────────────────────────────────────────────
export const SECTION_COLORS: Record<string, { hex: string; bg: string; text: string }> = {
  p1:  { hex: '#6366f1', bg: '#e0e7ff', text: '#4f46e5' },
  p2:  { hex: '#10b981', bg: '#d1fae5', text: '#059669' },
  gs1: { hex: '#f59e0b', bg: '#fef3c7', text: '#d97706' },
  gs2: { hex: '#f43f5e', bg: '#ffe4e6', text: '#e11d48' },
  gs3: { hex: '#a855f7', bg: '#f3e8ff', text: '#9333ea' },
  gs4: { hex: '#06b6d4', bg: '#cffafe', text: '#0891b2' },
  a1:  { hex: '#d946ef', bg: '#fae8ff', text: '#c026d3' },
  a2:  { hex: '#f97316', bg: '#ffedd5', text: '#ea580c' },
  ca:  { hex: '#14b8a6', bg: '#ccfbf1', text: '#0d9488' },
};
