import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import styles from './Settings.module.css';
import Layout from '../Layout/Layout';
import { FaUser, FaShieldAlt } from 'react-icons/fa';

function SettingsLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    console.log('Cerrando sesión...');
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  return (
    <Layout>
      <div className={styles.settingsContainer}>
        <h1>Configuración de la Cuenta</h1>

        <div className={styles.settingsContent}>
          <nav className={styles.settingsNav}>
            <NavLink
              to="/settings/profile"
              className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}
            >
              <FaUser className={styles.navIcon} /> Perfil
            </NavLink>
            <NavLink
              to="/settings/password"
              className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}
            >
              <FaShieldAlt className={styles.navIcon} /> Seguridad
            </NavLink>
             <button onClick={handleLogout} className={styles.logoutButton}>
               Cerrar sesión
             </button>
          </nav>

          <main className={styles.settingsPanel}>
            <Outlet />
          </main>
        </div>
      </div>
    </Layout>
  );
}

export default SettingsLayout;