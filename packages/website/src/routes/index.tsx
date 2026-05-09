import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import changelogData from "./changelog.json";

export const Route = createFileRoute("/")({
  component: Index,
});

export function meta() {
  return [
    { title: "Last Light - Multiplayer Zombie Survival Game" },
    {
      name: "description",
      content:
        "An online multiplayer game where you must survive the night against hordes of zombies. Build bases with your friends, collect weapons, and craft items to see how long you'll last.",
    },
  ];
}

interface ChangelogChanges {
  features: string[];
  bugFixes: string[];
  refactoring: string[];
  performance: string[];
}

interface ChangelogEntry {
  version: string;
  date: string;
  changes: ChangelogChanges;
}

const changelog: ChangelogEntry[] = changelogData;

function Index() {
  return (
    <div className="relative min-h-screen text-white" style={{ backgroundColor: "#00080e" }}>
      {/* Fixed background image - stays in place while scrolling */}
      <div
        className="fixed inset-0 w-full h-full"
        style={{
          backgroundImage: "url(/splash3.jpg)",
          backgroundSize: "contain",
          backgroundPosition: "top center",
          backgroundRepeat: "no-repeat",
          zIndex: 0,
        }}
      />

      {/* Hero Section with full background */}
      <div className="relative">
        {/* Content overlay */}
        <div
          className="relative z-10 container mx-auto px-4 py-8 max-w-7xl"
          style={{ paddingTop: "250px" }}
        >
          {/* Hero Section */}
          <div className="flex flex-col items-center text-center pt-12 pb-16">
            {/* Navigation Buttons */}
            <div className="flex flex-wrap gap-4 justify-center mb-10">
              <Link to="/play">
                <Button
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-10 py-6 text-lg shadow-lg shadow-red-900/50 transition-all hover:shadow-red-900/70 hover:scale-105"
                >
                  Join Game
                </Button>
              </Link>
              <Link to="/leaderboard">
                <Button
                  size="lg"
                  className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-red-600 text-white font-bold px-10 py-6 text-lg transition-all shadow-md"
                >
                  Leaderboard
                </Button>
              </Link>
              <a
                href="https://github.com/bugblazer/last_light"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-red-600 text-white font-bold px-10 py-6 text-lg transition-all shadow-md flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  GitHub
                </Button>
              </a>
            </div>

            {/* Game Description */}
            <div className="max-w-3xl">
              <p className="text-gray-400 text-base md:text-lg leading-relaxed">
                Team up with friends in this intense multiplayer survival game. Gather resources,
                craft weapons, build defenses, and fight waves of zombies that grow stronger each
                night.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
