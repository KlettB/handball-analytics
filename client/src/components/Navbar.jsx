import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Übersicht' },
  { to: '/matches', label: 'Spiele' },
  { to: '/players', label: 'Spieler' },
  { to: '/team', label: 'Team' },
];

export default function Navbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 flex items-center h-12 gap-8">
        <span className="font-bold text-white text-sm shrink-0">
          Handball Analytics
        </span>
        <div className="flex gap-6">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `text-sm transition-colors ${
                  isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
