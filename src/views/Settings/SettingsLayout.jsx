// src/views/Settings/SettingsLayout.jsx
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom'; // Importa NavLink y Outlet
import styles from './Settings.module.css'; // Necesitaremos crear este CSS
import Layout from '../Layout/Layout'; // Asumiendo que usas el Layout principal aquí
import { FaUser, FaShieldAlt } from 'react-icons/fa'; // Importa iconos de Font Awesome

function SettingsLayout() {
  const navigate = useNavigate(); // Para el botón de logout

  const handleLogout = () => {
    console.log('Cerrando sesión...');
    localStorage.removeItem('authToken'); // Limpia el token
    navigate('/login'); // Redirige a login
  };

  return (
    <Layout> {/* O envuelve con tu Layout principal como prefieras */}
      <div className={styles.settingsContainer}>
        <h1>Configuración de la Cuenta</h1>

        <div className={styles.settingsContent}>
          {/* Navegación Lateral/Pestañas */}
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
            {/* Botón de Cerrar Sesión */}
             <button onClick={handleLogout} className={styles.logoutButton}>
               Cerrar sesión
             </button>
          </nav>

          {/* Área donde se renderiza el componente hijo (Account o Password) */}
          <main className={styles.settingsPanel}>
            <Outlet /> {/* Renderiza el componente de la ruta anidada */}
          </main>
        </div>
      </div>
    </Layout>
  );
}

export default SettingsLayout;