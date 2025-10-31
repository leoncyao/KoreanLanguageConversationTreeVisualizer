import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">Korean Conversation Tree Game</Link>
      <ul className="navbar-nav">
        <li className="nav-item">
          <Link to="/" className="nav-link">Home</Link>
        </li>
        <li className="nav-item">
          <Link to="/translate" className="nav-link">Translate</Link>
        </li>
        {/* Add more navigation items as needed */}
      </ul>
    </nav>
  );
}

export default Navbar;

