import { useEffect } from "react";
import { ArrowRight, BadgeCheck, BookOpen, Briefcase, HeartHandshake, Sparkles, Target, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const visionPoints = [
  "Unique innovative methodologies",
  "Fun learning techniques at the core",
  "Study effectively with clear guidance",
  "Shape confident futures",
];

const missionPoints = [
  "Set new standards in commerce education",
  "Build conceptual clarity first",
  "Create a friendly, motivating, safe environment",
  "Deliver highest passing percentage and AIRs",
  "Develop confident, professional, grounded individuals",
  "Provide scholarships to 1000+ students by FY 2026",
];

const whyPoints = [
  "Interactive learning environment",
  "Customized study plans",
  "Regular mock exams and assessments",
  "Exclusive scholarships",
  "Career counseling and placement assistance",
  "Nationwide access",
  "Robust alumni network",
];

const ceoHighlights = [
  "14+ years of experience in education and CA coaching",
  "All India rank holder Chartered Accountant and Company Secretary",
  "Recognized by AsiaOne Magazine as India’s Emerging Greatest Leader 2022-2023",
  "Led Ednovate to recognition as an Emerging Brand and Promising MSME",
  "Worked with Reliance and Ambit RSM (merged with PwC)",
  "Avid musician: synthesizer, flute, harmonium and guitar",
];

const stats = [
  { label: "Years of leadership", value: "14+" },
  { label: "Scholarships target", value: "1000+" },
  { label: "Learning philosophy", value: "Fun + Focus" },
  { label: "Audience", value: "CA / CS / CMA" },
];

export default function AboutUs() {
  useEffect(() => {
    document.title = "About Us | Ednovate";
  }, []);

  return (
    <div className="bg-slate-50">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(244,114,182,0.16),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)]">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)", backgroundSize: "22px 22px" }} />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-6 lg:py-20">
          <div className="relative z-10 flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
              <Sparkles className="h-3.5 w-3.5" /> Redefining Commerce Education
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Learn with clarity, confidence, and the right kind of fun.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Ednovate transforms education for commerce and professional students pursuing CA, CMA, and ACCA with tailored
              solutions for quick comprehension, concept mastery, and extensive support.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Incubated in the 10K program by Goldman Sachs at NSRCEL, IIM Bangalore in 2023, Ednovate blends expert coaching,
              innovation, and practical learning to help students reach their goals.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 rounded-xl px-5 text-sm font-semibold shadow-lg shadow-sky-500/20">
                <Link to="/packages">
                  Explore Courses <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-slate-300 px-5 text-sm font-semibold">
                <Link to="/contact-us">Contact Us</Link>
              </Button>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
                  <p className="text-2xl font-black text-slate-950">{item.value}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10">
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_30px_80px_-35px_rgba(15,23,42,0.35)]">
              <img
                src="/about-us/hero-banner.png"
                alt="Ednovate About Us banner"
                className="h-[420px] w-full rounded-[1.5rem] object-cover"
              />
              <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/30 bg-slate-950/75 p-4 text-white shadow-xl backdrop-blur-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">Unlock your potential</p>
                <p className="mt-1 text-lg font-semibold">Learn online with a system built around concept clarity and rank results.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Target className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Our Vision</p>
                <h2 className="text-2xl font-black text-slate-950">Build a learning platform students trust.</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-[0.95fr_1.05fr] md:items-center">
              <img src="/about-us/vision.png" alt="Our vision" className="rounded-2xl border border-slate-200 object-cover shadow-sm" />
              <div>
                <p className="text-sm leading-7 text-slate-600">
                  To build a brand and a platform for students where unique innovative methodologies and fun learning techniques
                  sit at the core of teaching, helping them study effectively and achieve their goals.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {visionPoints.map((point) => (
                    <li key={point} className="flex gap-2">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><BookOpen className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Our Mission</p>
                <h2 className="text-2xl font-black text-slate-950">Set the benchmark for commerce coaching.</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-[0.95fr_1.05fr] md:items-center">
              <img src="/about-us/mission.png" alt="Our mission" className="rounded-2xl border border-slate-200 object-cover shadow-sm" />
              <div>
                <p className="text-sm leading-7 text-slate-600">
                  To be best-in-class and market leaders in providing professional coaching with focus on conceptual clarity,
                  a motivating environment, and measurable student success.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {missionPoints.map((point) => (
                    <li key={point} className="flex gap-2">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="bg-slate-950 py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:px-6">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Meet Our CEO</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">CA Ashish Shah</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              A visionary leader with 14+ years of experience in education and CA coaching, Ashish Shah combines academic depth,
              industry experience, and a student-first approach to create Ednovate’s learning culture.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {ceoHighlights.map((point) => (
                <li key={point} className="flex gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                <Link to="/contact-us">Talk to the Team</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-white/20 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10">
                <Link to="/packages">View Courses</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-[0.88fr_1.12fr] md:items-center">
            <div className="overflow-hidden rounded-[1.9rem] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/20">
              <img src="/about-us/ceo.jpg" alt="CA Ashish Shah" className="h-[420px] w-full rounded-[1.4rem] object-cover" />
            </div>
            <div className="rounded-[1.9rem] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200">
                <Briefcase className="h-3.5 w-3.5" /> Professional journey
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-200">
                Recognized by AsiaOne Magazine as “India’s Emerging Greatest Leader - 2022-2023”, Ashish Shah has also been part of
                leading organizations including Reliance and Ambit RSM (merged with PwC). His passion for teaching extends beyond
                academics, encouraging confidence, discipline, and creativity in students.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Recognized leader",
                  "Industry experience",
                  "Mentorship-driven",
                  "Music lover",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-700">Why Ednovate</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">Built for commerce students who want results.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Ednovate was created with a deep understanding of the pain points faced by CA and commerce students. The platform
              focuses on conceptual understanding, practical support, and a learning environment that keeps students moving.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {whyPoints.map((point) => (
                <div key={point} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <HeartHandshake className="h-4 w-4 shrink-0 text-indigo-600" />
                  <span className="text-sm font-medium text-slate-700">{point}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">What students get</p>
            <div className="mt-5 space-y-4 text-sm text-slate-700">
              {[
                "Interactive lectures and mentor-led doubt solving",
                "Structured test series and mock assessments",
                "Scholarships and support-driven learning",
                "Career guidance and alumni strength",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 p-5 text-white">
              <p className="text-lg font-bold">Start your journey</p>
              <p className="mt-1 text-sm text-white/90">Explore courses, meet the faculty, and learn with a system that supports rank preparation end-to-end.</p>
              <Button asChild className="mt-4 h-10 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                <Link to="/packages">
                  Browse Courses <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
