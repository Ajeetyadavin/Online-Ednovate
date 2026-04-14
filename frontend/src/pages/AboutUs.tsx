import { useEffect } from "react";
import { ArrowRight, BadgeCheck, BookOpen, Briefcase, HeartHandshake, Target, Users } from "lucide-react";
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

export default function AboutUs() {
  useEffect(() => {
    document.title = "About Us | Ednovate";
  }, []);

  return (
    <div className="bg-[#f7f7f5]">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)", backgroundSize: "22px 22px" }} />
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:gap-10 md:py-14 lg:grid-cols-[1.08fr_0.92fr] lg:px-6 lg:py-16">
          <div className="relative z-10 flex flex-col justify-center text-left">
            <h1 className="mt-5 max-w-3xl font-serif text-3xl font-bold leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Learn with clarity, confidence, and the right kind of fun.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-700 sm:text-base">
              Ednovate transforms education for commerce and professional students pursuing CA, CMA, and ACCA with tailored
              solutions for quick comprehension, concept mastery, and extensive support.
            </p>
            <p className="mt-3 max-w-2xl text-[14px] leading-7 text-slate-600 sm:text-[15px]">
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
          </div>

          <div className="relative z-10">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-lg">
              <img
                src="/about-us/hero-banner.png"
                alt="Ednovate About Us banner"
                className="h-64 w-full rounded-xl object-cover sm:h-80 lg:h-[380px]"
              />
              <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/20 bg-slate-950/75 p-3 text-white shadow-xl backdrop-blur-sm sm:inset-x-6 sm:bottom-6 sm:p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-200">Unlock your potential</p>
                <p className="mt-1 text-sm font-semibold sm:text-base">Learn online with a system built around concept clarity and rank results.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Target className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Our Vision</p>
                <h2 className="font-serif text-2xl font-bold text-slate-950">Build a learning platform students trust.</h2>
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

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><BookOpen className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Our Mission</p>
                <h2 className="font-serif text-2xl font-bold text-slate-950">Set the benchmark for commerce coaching.</h2>
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

      <section className="border-y border-slate-200 bg-white py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:px-6">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-600">Meet Our CEO</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-slate-950 sm:text-4xl">CA Ashish Shah</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-700 sm:text-base">
              A visionary leader with 14+ years of experience in education and CA coaching, Ashish Shah combines academic depth,
              industry experience, and a student-first approach to create Ednovate’s learning culture.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {ceoHighlights.map((point) => (
                <li key={point} className="flex gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 rounded-xl px-5 text-sm font-semibold">
                <Link to="/contact-us">Talk to the Team</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                <Link to="/packages">View Courses</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-[0.88fr_1.12fr] md:items-center">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-md">
              <img src="/about-us/ceo.jpg" alt="CA Ashish Shah" className="h-[360px] w-full rounded-xl object-cover sm:h-[420px]" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
                <Briefcase className="h-3.5 w-3.5" /> Professional journey
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-700">
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
                  <div key={item} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-700">Why Ednovate</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-slate-950 sm:text-4xl">Built for commerce students who want results.</h2>
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

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-800">
              <p className="text-lg font-bold">Start your journey</p>
              <p className="mt-1 text-sm text-slate-600">Explore courses, meet the faculty, and learn with a system that supports rank preparation end-to-end.</p>
              <Button asChild className="mt-4 h-10 rounded-xl px-4 text-sm font-semibold">
                <Link to="/packages">
                  Browse Courses <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 lg:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-700">Our promise</p>
              <h2 className="mt-3 font-serif text-3xl font-bold text-slate-950 sm:text-4xl">Learning that feels structured, human, and effective.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                From the first class to the final result, Ednovate keeps students supported with clarity, discipline, and a fun
                learning experience that is practical enough to stick.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Rank-oriented approach",
                "Concept-first teaching",
                "Supportive mentor culture",
                "Scholarship-driven access",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
