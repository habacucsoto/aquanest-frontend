import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/LogoAquaNest.png';
import styles from './Navbar.module.css';
import { FaBars, FaWater, FaTachometerAlt, FaFish, FaUser } from 'react-icons/fa';
import { motion } from 'framer-motion';

function Navbar({ isOpen, onToggle }) {
    const navigate = useNavigate();
    const navbarRef = useRef(null);
    const toggleNavbar = () => {
      onToggle(!isOpen);
    };

    useEffect(() => {
      const handleClickOutside = (event) => {
          if (isOpen && navbarRef.current && !navbarRef.current.contains(event.target)) {
              onToggle(false);
          }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen, onToggle]);

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        navigate('/login');
      };    
  
    const rotateIcon = {
      open: { rotate: 90 },
      closed: { rotate: 0 },
    };
  
    const location = useLocation();
  
    const isActive = (path) => {
        return location.pathname.startsWith(path);
      };
  
    return (
        <>
        <motion.div
          className={styles.toggleIcon}
          onClick={toggleNavbar}
          variants={rotateIcon}
          animate={isOpen ? 'open' : 'closed'}
          transition={{ duration: 0.3 }}
        >
          <FaBars />
        </motion.div>
        
        <nav className={`${styles.navbar} ${isOpen ? styles.open : styles.closed}`} ref={navbarRef}>
        <div className={styles.logoContainer}>
          <img src={logo} alt="Logo de la App" className={styles.logo} />
          <span className={styles.appName}>AquaNest</span>
        </div>
        <div className={styles.separatorTop}></div>
        <ul className={styles.navLinks}>
          <li key="estanques">
            <Link to="/ponds" className={`${styles.navLink} ${isActive('/ponds') ? styles.active : ''}`}>
              <FaWater className={styles.navIcon} />
              <span>Estanques</span>
            </Link>
          </li>
          <li key="dashboard">
            {location.pathname.startsWith('/control-nitrate/') || location.pathname.startsWith('/control-temperature/') || location.pathname.startsWith('/dashboard/') ? (
              <span className={`${styles.navLink} ${styles.active}`}>
                <FaTachometerAlt className={styles.navIcon} />
                <span>Dashboard</span>
              </span>
            ) : location.pathname === '/dashboard' ? (
              <span className={`${styles.navLink} ${styles.active}`}>
                <FaTachometerAlt className={styles.navIcon} />
                <span>Dashboard</span>
              </span>
            ) : (
              <span className={`${styles.navLink}`}>
                <FaTachometerAlt className={styles.navIcon} />
                <span>Dashboard</span>
              </span>
            )}
          </li>
          <li key="especies">
            <Link to="/species" className={`${styles.navLink} ${isActive('/species') ? styles.active : ''}`}>
              <FaFish className={styles.navIcon} />
              <span>Especies</span>
            </Link>
          </li>
          <div className={styles.linksSeparator}></div>
          <li key="usuario">
             <Link
                to="/settings/profile"
                className={`${styles.navLink} ${isActive('/settings') ? styles.active : ''}`}
             >
                <FaUser className={styles.navIcon} />
                <span>Usuario</span>
             </Link>
          </li>
        </ul>
        <div className={styles.separatorTop}></div>
        <button className={styles.logoutButton} onClick={handleLogout}>Cerrar sesión</button>
      </nav>
      </>
    );
  }
  
  export default Navbar;