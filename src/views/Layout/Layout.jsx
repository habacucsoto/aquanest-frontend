// src/components/Layout/Layout.jsx
import React, { useState, useEffect } from 'react';
import Navbar from '../Navbar/Navbar';
import styles from './Layout.module.css';

function Layout({ children }) {
  const [isNavbarOpen, setIsNavbarOpen] = useState(false); // Estado para controlar si la Navbar está abierta

  const handleNavbarToggle = (isOpen) => {
    setIsNavbarOpen(isOpen);
  };

  useEffect(() => {
    document.body.style.overflow = isNavbarOpen ? 'hidden' : 'auto';

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isNavbarOpen]);

  return (
    <div className={styles.pageContainer}>
      <Navbar isOpen={isNavbarOpen} onToggle={handleNavbarToggle} />
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}

export default Layout;