import Link from "next/link";
import { Film, Calendar, Play } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm flex flex-col gap-8">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
            <Film className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-500">
            CineSched
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mt-4">
            The agentic film production scheduling platform. 
            Generate feasible schedules with CP-SAT and AI reasoning in seconds.
          </p>
        </div>

        <div className="flex gap-6 mt-8">
          <Link 
            href="/projects" 
            className="group flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
          >
            <Calendar className="w-5 h-5" />
            <span>Go to Projects</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full">
          {[
            {
              title: "CP-SAT Solver",
              desc: "Hard constraint satisfaction ensuring feasible math.",
              icon: "🧮"
            },
            {
              title: "LangGraph Agents",
              desc: "Multi-agent loop for constraint relaxation and replanning.",
              icon: "🤖"
            },
            {
              title: "SaaS Ready",
              desc: "Multi-tenant backend with FastAPI and Supabase.",
              icon: "🚀"
            }
          ].map((feature, i) => (
            <div key={i} className="glass p-6 rounded-2xl flex flex-col gap-3 transition-transform hover:-translate-y-1">
              <span className="text-3xl">{feature.icon}</span>
              <h3 className="text-lg font-bold text-slate-200">{feature.title}</h3>
              <p className="text-slate-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
