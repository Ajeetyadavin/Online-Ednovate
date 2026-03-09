export interface Course {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  language: string;
  lectures: number;
  hours: number;
  price: number;
  originalPrice: number;
  discount: number;
  image: string;
  professor: string;
  isCombo?: boolean;
  isMaterial?: boolean;
}

export const categories = [
  { id: "all", label: "All Courses" },
  { id: "ca-foundation", label: "CA Foundation" },
  { id: "ca-inter", label: "CA Inter" },
  { id: "ca-final", label: "CA Final" },
  { id: "cs-executive", label: "CS Executive" },
  { id: "cs-professional", label: "CS Professional" },
  { id: "cma", label: "CMA" },
  { id: "cfa", label: "CFA" },
  { id: "acca", label: "ACCA" },
  { id: "fyjc", label: "FYJC (11th)" },
  { id: "syjc", label: "SYJC (12th)" },
];

export interface CourseGroup {
  id: string;
  label: string;
  children: { id: string; label: string }[];
}

export const courseGroups: CourseGroup[] = [
  {
    id: "ca",
    label: "CA",
    children: [
      { id: "ca-foundation", label: "Foundation" },
      { id: "ca-inter", label: "Inter" },
      { id: "ca-final", label: "Final" },
    ],
  },
  {
    id: "cs",
    label: "CS",
    children: [
      { id: "cs-executive", label: "Executive" },
      { id: "cs-professional", label: "Professional" },
    ],
  },
  {
    id: "cma",
    label: "CMA",
    children: [],
  },
  {
    id: "cfa",
    label: "CFA",
    children: [],
  },
  {
    id: "acca",
    label: "ACCA",
    children: [],
  },
  {
    id: "fyjc",
    label: "FYJC (11th)",
    children: [],
  },
  {
    id: "syjc",
    label: "SYJC (12th)",
    children: [],
  },
];

export const quickCategories = [
  { id: "ca", label: "CA", color: "bg-primary" },
  { id: "cs", label: "CS", color: "bg-accent" },
  { id: "cma", label: "CMA", color: "bg-primary" },
  { id: "cfa", label: "CFA", color: "bg-accent" },
  { id: "acca", label: "ACCA", color: "bg-primary" },
  { id: "fyjc", label: "FYJC", color: "bg-accent" },
  { id: "syjc", label: "SYJC", color: "bg-primary" },
];

export const courseTabs = [
  { id: "combo", label: "COMBO Packs" },
  { id: "materials", label: "Study Materials" },
  { id: "ca-inter", label: "CA Inter" },
  { id: "ca-final", label: "CA Final" },
  { id: "ca-foundation", label: "CA Foundation" },
  { id: "cs", label: "CS" },
  { id: "cma", label: "CMA" },
];

export const courses: Course[] = [
  {
    id: "1",
    title: "CA Foundation Complete Combo Pack",
    category: "ca-foundation",
    subcategory: "combo",
    language: "Hindi + English",
    lectures: 320,
    hours: 480,
    price: 24999,
    originalPrice: 39999,
    discount: 38,
    image: "/placeholder.svg",
    professor: "Multiple Faculty",
    isCombo: true,
  },
  {
    id: "2",
    title: "Accounting & Finance - CA Foundation",
    category: "ca-foundation",
    subcategory: "ca-foundation",
    language: "Hindi",
    lectures: 85,
    hours: 120,
    price: 7999,
    originalPrice: 12999,
    discount: 38,
    image: "/placeholder.svg",
    professor: "Prof. Sharma",
  },
  {
    id: "3",
    title: "Business Law - CA Foundation",
    category: "ca-foundation",
    subcategory: "ca-foundation",
    language: "English",
    lectures: 60,
    hours: 90,
    price: 5999,
    originalPrice: 9999,
    discount: 40,
    image: "/placeholder.svg",
    professor: "Prof. Mehta",
  },
  {
    id: "4",
    title: "CA Inter Group 1 Complete Pack",
    category: "ca-inter",
    subcategory: "combo",
    language: "Hindi + English",
    lectures: 450,
    hours: 680,
    price: 34999,
    originalPrice: 54999,
    discount: 36,
    image: "/placeholder.svg",
    professor: "Multiple Faculty",
    isCombo: true,
  },
  {
    id: "5",
    title: "Advanced Accounting - CA Inter",
    category: "ca-inter",
    subcategory: "ca-inter",
    language: "Hindi",
    lectures: 95,
    hours: 140,
    price: 8999,
    originalPrice: 14999,
    discount: 40,
    image: "/placeholder.svg",
    professor: "Prof. Gupta",
  },
  {
    id: "6",
    title: "Auditing & Assurance - CA Inter",
    category: "ca-inter",
    subcategory: "ca-inter",
    language: "English",
    lectures: 72,
    hours: 105,
    price: 7499,
    originalPrice: 11999,
    discount: 38,
    image: "/placeholder.svg",
    professor: "Prof. Patel",
  },
  {
    id: "7",
    title: "CA Final Complete Combo Pack",
    category: "ca-final",
    subcategory: "combo",
    language: "Hindi + English",
    lectures: 520,
    hours: 780,
    price: 44999,
    originalPrice: 69999,
    discount: 36,
    image: "/placeholder.svg",
    professor: "Multiple Faculty",
    isCombo: true,
  },
  {
    id: "8",
    title: "Financial Reporting - CA Final",
    category: "ca-final",
    subcategory: "ca-final",
    language: "English",
    lectures: 110,
    hours: 165,
    price: 11999,
    originalPrice: 18999,
    discount: 37,
    image: "/placeholder.svg",
    professor: "Prof. Desai",
  },
  {
    id: "9",
    title: "CS Executive Complete Pack",
    category: "cs-executive",
    subcategory: "cs",
    language: "Hindi + English",
    lectures: 280,
    hours: 420,
    price: 22999,
    originalPrice: 35999,
    discount: 36,
    image: "/placeholder.svg",
    professor: "Multiple Faculty",
    isCombo: true,
  },
  {
    id: "10",
    title: "Company Law - CS Executive",
    category: "cs-executive",
    subcategory: "cs",
    language: "Hindi",
    lectures: 65,
    hours: 95,
    price: 6499,
    originalPrice: 10999,
    discount: 41,
    image: "/placeholder.svg",
    professor: "Prof. Jain",
  },
  {
    id: "11",
    title: "CMA Foundation Study Material",
    category: "cma",
    subcategory: "materials",
    language: "English",
    lectures: 0,
    hours: 0,
    price: 3999,
    originalPrice: 5999,
    discount: 33,
    image: "/placeholder.svg",
    professor: "Ednovate Team",
    isMaterial: true,
  },
  {
    id: "12",
    title: "CFA Level 1 Complete Course",
    category: "cfa",
    subcategory: "cfa",
    language: "English",
    lectures: 200,
    hours: 300,
    price: 29999,
    originalPrice: 45999,
    discount: 35,
    image: "/placeholder.svg",
    professor: "Prof. Kumar",
  },
];

export const stats = [
  { label: "Courses Purchased", value: 15000, suffix: "+" },
  { label: "Students Enrolled", value: 50000, suffix: "+" },
  { label: "Uploaded Videos", value: 25000, suffix: "+" },
  { label: "Listed Courses", value: 500, suffix: "+" },
];

export const whyChooseUs = [
  { icon: "BookOpen", title: "All Subjects Under One Roof", description: "Complete course coverage for CA, CS, CMA and more" },
  { icon: "Monitor", title: "HD Recorded Lectures", description: "Crystal clear video quality for the best learning experience" },
  { icon: "Users", title: "Choice of Professor", description: "Learn from your preferred faculty members" },
  { icon: "Globe", title: "Choice of Language", description: "Available in Hindi, English and bilingual formats" },
  { icon: "Wifi", title: "Seamless Streaming", description: "Buffer-free streaming on any device, anywhere" },
  { icon: "Layers", title: "Opt Any Chapter", description: "Pick and choose individual chapters as per your needs" },
  { icon: "Award", title: "Unique Lecture Format", description: "Structured and engaging teaching methodology" },
  { icon: "MessageCircle", title: "Doubt Solving System", description: "Get your queries resolved by expert faculty" },
  { icon: "Target", title: "Personalised Study Plan", description: "Custom study schedules tailored to your goals" },
];

export const testimonials = [
  {
    id: "1",
    name: "Priya Sharma",
    course: "CA Inter",
    feedback: "Ednovate's platform made my CA Inter preparation so much easier. The video lectures are top-notch and the doubt-solving feature is incredibly helpful.",
    rating: 5,
  },
  {
    id: "2",
    name: "Rahul Verma",
    course: "CA Foundation",
    feedback: "I cleared my CA Foundation in the first attempt thanks to Ednovate. The combo pack was great value for money and covered everything I needed.",
    rating: 5,
  },
  {
    id: "3",
    name: "Anita Desai",
    course: "CS Executive",
    feedback: "The flexibility to choose my professor and language made all the difference. Highly recommend Ednovate for CS preparation!",
    rating: 4,
  },
  {
    id: "4",
    name: "Vikash Kumar",
    course: "CA Final",
    feedback: "Excellent study materials and recorded lectures. The personalised study plan helped me manage my time effectively during CA Final prep.",
    rating: 5,
  },
];

export const bannerSlides = [
  { id: 1, image: "/banners/banner1.jpg" },
  { id: 2, image: "/banners/banner2.jpg" },
  { id: 3, image: "/banners/banner3.jpg" },
  { id: 4, image: "/banners/banner4.jpg" },
];
