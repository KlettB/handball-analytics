import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TeamProvider } from './TeamContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MatchList from './pages/MatchList';
import MatchDetail from './pages/MatchDetail';
import Players from './pages/Players';
import Team from './pages/Team';
import Standings from './pages/Standings';
import OpponentDetail from './pages/OpponentDetail';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <TeamProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/matches" element={<MatchList />} />
            <Route path="/matches/:id" element={<MatchDetail />} />
            <Route path="/players" element={<Players />} />
            <Route path="/team" element={<Team />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/teams/:teamId" element={<OpponentDetail />} />
          </Route>
        </Routes>
      </TeamProvider>
    </BrowserRouter>
  </React.StrictMode>
);
