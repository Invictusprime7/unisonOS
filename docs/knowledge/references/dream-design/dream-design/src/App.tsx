/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// @unison-canonical-router
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.tsx';
import About from './pages/About.tsx';
import Work from './pages/Work.tsx';

export default function App() {
  return (
    
      <div className="unison-runtime-glass" data-ut-source-locator="/src/App.tsx:11:7" data-ut-source-ast="/src/App.tsx#bccfbd13fcd0402f" data-ut-source-hash="52e2a824fa7806d8">
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/work" element={<Work />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    
  );
}
