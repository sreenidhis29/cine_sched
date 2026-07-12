'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Marquee } from '@/components/ui/Marquee';
import { Briefcase, Navigation, Sun, DollarSign, Calendar } from 'lucide-react';

const reviews = [
  {
    name: "A2 Productions",
    username: "@a2_prod",
    body: "Solving scheduling conflicts used to take days of back-and-forth emails. CineSched does it in minutes.",
    img: "https://avatar.vercel.sh/jack",
  },
  {
    name: "Tungsten Creative",
    username: "@tungsten",
    body: "The CP-SAT solver is robust. It honors complex cast travel times and union rules with absolute precision.",
    img: "https://avatar.vercel.sh/jill",
  },
  {
    name: "Director's Cut Studio",
    username: "@dc_studio",
    body: "Love the transparency of the agent reasoning trace. I know exactly why decisions were made.",
    img: "https://avatar.vercel.sh/john",
  },
  {
    name: "Golden Hour Films",
    username: "@golden_hour",
    body: "Automated call sheets with weather routing saved our outdoor shoot last week when storms rolled in.",
    img: "https://avatar.vercel.sh/jane",
  },
  {
    name: "Apex Line Producer",
    username: "@apex_line",
    body: "Best scheduling assistant on the market. The budget planner agent kept our contingency fully intact.",
    img: "https://avatar.vercel.sh/jenny",
  },
  {
    name: "Nova Cinema",
    username: "@nova_cinema",
    body: "Multi-agent log feeds look and feel like an enterprise war room. Truly state-of-the-art.",
    img: "https://avatar.vercel.sh/james",
  },
];

const firstRow = reviews.slice(0, reviews.length / 2);
const secondRow = reviews.slice(reviews.length / 2);

const ReviewCard = ({
  img,
  name,
  username,
  body,
}: {
  img: string;
  name: string;
  username: string;
  body: string;
}) => {
  return (
    <figure className="relative w-64 cursor-pointer overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 hover:bg-surface-container-high transition-colors duration-200">
      <div className="flex flex-row items-center gap-2">
        <img className="rounded-full" width="32" height="32" alt="" src={img} />
        <div className="flex flex-col">
          <figcaption className="text-sm font-bold text-on-surface">
            {name}
          </figcaption>
          <p className="text-xs text-primary-container font-mono">{username}</p>
        </div>
      </div>
      <blockquote className="mt-2 text-sm text-on-surface-variant leading-relaxed">"{body}"</blockquote>
    </figure>
  );
};

interface GridItemProps {
  area: string;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
}

const GridItem = ({ area, icon, title, description }: GridItemProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <li className={`min-h-[14rem] list-none ${area} group`}>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative h-full rounded-2xl p-[3px] overflow-hidden cursor-pointer bg-outline-variant/40 transition-all duration-300 hover:scale-[1.01]"
        style={{
          boxShadow: isHovered ? '0 0 30px rgba(255,184,0,0.2)' : 'none',
        }}
      >
        {/* Glowing border and background radial trail */}
        {isHovered && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle 160px at ${coords.x}px ${coords.y}px, #ffb800, transparent 75%)`,
            }}
          />
        )}
        
        {/* Card Inner Content */}
        <div className="relative h-full w-full rounded-[13px] bg-[#1a1b1b] p-6 flex flex-col justify-between gap-6 overflow-hidden">
          <div className="relative flex flex-1 flex-col justify-between gap-4 z-10">
            <div className="w-fit rounded-lg border border-outline-variant bg-surface-container-high p-2.5 text-[#ffb800]">
              {icon}
            </div>
            <div className="space-y-3">
              <h3 className="font-headline-md text-xl font-bold text-on-surface">
                {title}
              </h3>
              <p className="font-body-md text-sm text-on-surface-variant/80 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};

export default function HeroPage() {
  const router = useRouter();

  useEffect(() => {
    // If user is already logged in, redirect to projects list
    const token = sessionStorage.getItem('access_token');
    if (token) {
      router.push('/projects');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-on-surface select-none overflow-x-hidden font-body-md">

      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-surface-dim/80 backdrop-blur-md border-b border-outline-variant">
        <div className="flex justify-between items-center px-gutter py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="w-10 h-10 object-contain rounded" alt="CineSched Logo" />
            <span className="font-headline-md text-headline-md font-bold text-primary tracking-tight">CINE SCHED</span>
          </div>

          <div className="hidden md:flex gap-8">
            <a href="#" className="font-body-md text-primary font-bold border-b-2 border-primary pb-1">Platform</a>
            <a href="#agents" className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-200">Agents</a>
            <a href="#" className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-200">Constraints</a>
            <a href="#" className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-200">Pricing</a>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="bg-primary-container text-on-primary-fixed font-bold px-6 py-2 rounded transition-all active:opacity-80 active:scale-95 shadow-lg shadow-primary-container/10 hover:brightness-110"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="bg-primary-container text-on-primary-fixed font-bold px-6 py-2 rounded transition-all active:opacity-80 active:scale-95 shadow-lg shadow-primary-container/10 hover:brightness-110"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/45 z-10"></div>
          <img
            src="/hero-bg.png"
            className="w-full h-full object-cover"
            alt="Professional film production studio at night with cinema camera rigs and tungsten lighting"
          />
          <div className="hero-gradient absolute inset-0 z-20"></div>
        </div>

        <div className="relative z-30 max-w-7xl mx-auto px-margin-safe w-full">
          <div className="max-w-3xl">
            <h1 className="font-display-lg text-display-lg md:text-[64px] md:leading-[1.1] mb-6 text-on-surface">
              AI-Driven <br />
              <span className="text-primary-container">Production Scheduling</span>
            </h1>

            <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 max-w-2xl leading-relaxed">
              The first agentic scheduling platform that genuinely respects your budget, cast availability, and equipment constraints. Let multiple AI agents solve the logistical puzzle for you.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="bg-primary-container text-on-primary-fixed font-bold px-8 py-4 rounded-lg flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 text-lg shadow-lg hover:shadow-primary-container/20"
              >
                Get Started
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Floating Data Panels (Decorative) */}
        <div className="hidden lg:block absolute right-[5%] bottom-[15%] z-30 w-96 space-y-4">
          <div className="glass-panel p-panel-padding rounded-xl border-l-4 border-primary-container animate-in fade-in slide-in-from-bottom-5 duration-700 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono-data text-mono-data text-primary-container uppercase">Constraint Analysis</span>
              <span className="text-[10px] text-on-surface-variant">Live Feed</span>
            </div>
            <div className="space-y-2">
              <div className="h-1 w-full bg-surface-container rounded overflow-hidden">
                <div className="h-full bg-primary-container w-[78%]"></div>
              </div>
              <p className="font-mono-data text-[11px] text-on-surface/70">Resolving Cast Conflict: Lead Actor Block 12</p>
            </div>
          </div>
          <div className="glass-panel p-panel-padding rounded-xl animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-150 shadow-2xl">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container">psychology</span>
              </div>
              <div>
                <p className="font-headline-md text-sm text-on-surface">Agent Consensus</p>
                <p className="font-body-md text-xs text-on-surface-variant">4 Agents on Optimization V2.1</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-surface-container-lowest py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-margin-safe">
          <div className="text-center mb-20">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4">Engineered for Production</h2>
            <div className="h-1 w-20 bg-primary-container mx-auto"></div>
          </div>

          <div className="manifesto-showcase">
            <div className="presentation-stage">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full max-w-6xl justify-items-center">
                {/* Card 1 */}
                <div className="poster-card">
                  <div className="css-mesh-grain" />
                  <div className="drafting-grid" />
                  <div className="geo-orb" />
                  <div className="type-container">
                    <div className="huge-text word-1">MULTI</div>
                    <div className="huge-text word-2 !text-[#131313]" style={{ WebkitTextStroke: 'none' }}>AGENT.</div>
                  </div>
                  <div className="tape-ribbon">
                    <div className="tape-scroll">
                      <span>LOGICAL INFERENCE // REASONING // AGENTS CONSENSUS // </span>
                      <span>LOGICAL INFERENCE // REASONING // AGENTS CONSENSUS // </span>
                    </div>
                  </div>
                  <div className="poster-footer">
                    <div className="manifesto-text text-left">
                      <p className="vol">VOL. 01 / AGENTS</p>
                      <p className="desc text-left">
                        Distinct agents act as your Producer, Line Producer, and Coordinator, reasoning through constraints collaboratively to find the optimal path.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="poster-card">
                  <div className="css-mesh-grain" />
                  <div className="drafting-grid" />
                  <div className="geo-orb" />
                  <div className="type-container">
                    <div className="huge-text word-1">RULES</div>
                    <div className="huge-text word-2 !text-[#131313]" style={{ WebkitTextStroke: 'none' }}>SOLVED.</div>
                  </div>
                  <div className="tape-ribbon">
                    <div className="tape-scroll">
                      <span>SATISFIABILITY VERIFIED // MATH OPTIMIZATION // CP-SAT // </span>
                      <span>SATISFIABILITY VERIFIED // MATH OPTIMIZATION // CP-SAT // </span>
                    </div>
                  </div>
                  <div className="poster-footer">
                    <div className="manifesto-text text-left">
                      <p className="vol">VOL. 02 / MATH</p>
                      <p className="desc text-left">
                        We don't guess. The AI extracts requirements and formulates them for a CP-SAT solver, ensuring legal and technical compliance.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="poster-card">
                  <div className="css-mesh-grain" />
                  <div className="drafting-grid" />
                  <div className="geo-orb" />
                  <div className="type-container">
                    <div className="huge-text word-1">LIVE</div>
                    <div className="huge-text word-2 !text-[#131313]" style={{ WebkitTextStroke: 'none' }}>TRACE.</div>
                  </div>
                  <div className="tape-ribbon">
                    <div className="tape-scroll">
                      <span>TRACE LOGGING // REAL-TIME ACTIVITY FEED // TRANSPARENCY // </span>
                      <span>TRACE LOGGING // REAL-TIME ACTIVITY FEED // TRANSPARENCY // </span>
                    </div>
                  </div>
                  <div className="poster-footer">
                    <div className="manifesto-text text-left">
                      <p className="vol">VOL. 03 / LOGS</p>
                      <p className="desc text-left">
                        Watch the agents think in real-time. Full transparency into how every scheduling decision and relaxation was made. No black boxes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Agents Section */}
          <div id="agents" className="relative flex w-full flex-col items-center justify-center overflow-hidden mt-24 pt-16 border-t border-outline-variant/20">
            <div className="text-center mb-12">
              <p className="font-mono-data text-xs text-primary-container uppercase tracking-widest mb-2">INTELLIGENT LOGISTICS</p>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4">Meet the Agents</h2>
              <div className="h-1 w-20 bg-primary-container mx-auto mb-4"></div>
              <p className="font-body-md text-on-surface-variant max-w-xl mx-auto leading-relaxed">
                CineSched is powered by five distinct specialized AI agents working together to solve your logistical challenges.
              </p>
            </div>

            <ul className="grid grid-cols-1 grid-rows-none gap-6 w-full max-w-6xl md:grid-cols-12 md:grid-rows-3 lg:gap-6 xl:grid-rows-2">
              <GridItem
                area="md:[grid-area:1/1/2/7] xl:[grid-area:1/1/2/5]"
                icon={<Briefcase className="h-5 w-5" />}
                title="Producer Agent"
                description="Formulates high-level logic, sets day limits, tracks scene priorities, and negotiates availability bounds."
              />

              <GridItem
                area="md:[grid-area:1/7/2/13] xl:[grid-area:2/1/3/5]"
                icon={<Navigation className="h-5 w-5" />}
                title="Route Optimizer"
                description="Queries OSRM distance matrices and uses OR-Tools to solve travel routing sequences between shoot locations."
              />

              <GridItem
                area="md:[grid-area:2/1/3/7] xl:[grid-area:1/5/3/8]"
                icon={<Sun className="h-5 w-5" />}
                title="Shoot Window Planner"
                description="Retrieves weather forecasts, scores scene suitability, and plans around weather constraints."
              />

              <GridItem
                area="md:[grid-area:2/7/3/13] xl:[grid-area:1/8/2/13]"
                icon={<DollarSign className="h-5 w-5" />}
                title="Budget Analyst"
                description="Calculates expenditures, models cast rates, handles rentals, and manages contingency guidelines."
              />

              <GridItem
                area="md:[grid-area:3/1/4/13] xl:[grid-area:2/8/3/13]"
                icon={<Calendar className="h-5 w-5" />}
                title="Coordinator Agent"
                description="Publishes FPDF call sheets, verifies calendar bounds, and coordinates alerts for casting overlaps."
              />
            </ul>
          </div>

          {/* Marquee Section */}
          <div className="relative flex w-full flex-col items-center justify-center overflow-hidden mt-20 pt-10 border-t border-outline-variant/20">
            <div className="text-center mb-10">
              <p className="font-mono-data text-xs text-primary-container uppercase tracking-widest mb-2">PROVEN IN THE FIELD</p>
              <h3 className="font-headline-md text-2xl text-on-surface">Trusted by Leading Teams</h3>
            </div>
            
            <Marquee pauseOnHover className="[--duration:25s]">
              {firstRow.map((review) => (
                <ReviewCard key={review.username} {...review} />
              ))}
            </Marquee>
            <Marquee reverse pauseOnHover className="[--duration:25s] mt-2">
              {secondRow.map((review) => (
                <ReviewCard key={review.username} {...review} />
              ))}
            </Marquee>
            
            {/* Gradient Fades on edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-background to-transparent"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-background to-transparent"></div>
          </div>
        </div>

        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary-container/5 blur-[120px] -z-10 rounded-full"></div>
      </section>

      {/* Stats / Trust Section */}
      <section className="bg-surface-dim py-20 border-y border-outline-variant">
        <div className="max-w-7xl mx-auto px-margin-safe">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
            {/* Card 1 */}
            <div className="stats-card">
              <div className="bar" />
              <div className="card_form font-bold text-lg text-black">
                98%
              </div>
              <div className="card_data">
                <div className="text">
                  <span className="text_m">Constraint Accuracy</span>
                  <div className="cube text_s">
                    <span className="side front">98% Accuracy</span>
                    <span className="side top">Verified Index</span>
                  </div>
                  <span className="text_d">
                    Rigorous mathematical evaluation confirms logical consistency across all scheduling constraints.
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="stats-card">
              <div className="bar" />
              <div className="card_form font-bold text-lg text-black">
                40h
              </div>
              <div className="card_data">
                <div className="text">
                  <span className="text_m">Weekly Time Saved</span>
                  <div className="cube text_s">
                    <span className="side front">40 Hours Saved</span>
                    <span className="side top">Per Production</span>
                  </div>
                  <span className="text_d">
                    Eliminates manual back-and-forth negotiations and conflict resolution tasks automatically.
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="stats-card">
              <div className="bar" />
              <div className="card_form font-bold text-lg text-black">
                12M+
              </div>
              <div className="card_data">
                <div className="text">
                  <span className="text_m">Decisions Modeled</span>
                  <div className="cube text_s">
                    <span className="side front">12M+ Decisions</span>
                    <span className="side top">Solved Instantly</span>
                  </div>
                  <span className="text_d">
                    CP-SAT solver evaluates millions of combinational scenarios to find the optimal sequence.
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="stats-card">
              <div className="bar" />
              <div className="card_form font-bold text-lg text-black">
                24/7
              </div>
              <div className="card_data">
                <div className="text">
                  <span className="text_m">Agent Monitoring</span>
                  <div className="cube text_s">
                    <span className="side front">24/7 Monitoring</span>
                    <span className="side top">Continuous Checks</span>
                  </div>
                  <span className="text_d">
                    Continuous context-aware checks and system monitoring ensure timeline stability.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin-safe max-w-7xl mx-auto py-stack-lg gap-stack-md">
          <div className="flex flex-col gap-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <img src="/logo.png" className="w-8 h-8 opacity-80 rounded" alt="Footer Logo" />
              <span className="font-headline-md text-headline-md text-on-surface">CINE SCHED</span>
            </div>
            <p className="font-label-md text-label-md text-on-secondary-container">© 2026 CineSched. Engineered for Production.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            <a href="#" className="font-label-md text-on-secondary-container hover:text-primary-fixed-dim transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
