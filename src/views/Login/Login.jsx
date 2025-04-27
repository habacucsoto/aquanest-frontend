import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Importa useNavigate
import axios from 'axios'; // Importa axios
import styles from './Login.module.css';
import logo from '../../assets/LogoAquaNest.png';

// Define la URL base de tu API
const API_URL = 'http://localhost:8080'; // Ajusta si es diferente

function Login() {
  // Cambiamos 'username' por 'email' para que coincida con la API
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); // Estado para mensajes de error
  const [loading, setLoading] = useState(false); // Estado para indicar carga
  const navigate = useNavigate(); // Hook para navegar programáticamente

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(''); // Limpia errores previos
    setLoading(true); // Empieza la carga

    try {
      // Petición POST a /auth/login
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: email,       // Usa el estado 'email'
        password: password
      });

      // Si la petición es exitosa (status 2xx)
      if (response.data && response.data.token) {
        console.log('Login exitoso:', response.data);
        // Guarda el token en localStorage
        localStorage.setItem('authToken', response.data.token);
        // Redirige al Dashboard
        navigate('/ponds'); // Asegúrate que '/dashboard' exista en tus rutas de App.js
      } else {
        // Caso inesperado si no hay token en la respuesta
        setError('Respuesta inesperada del servidor.');
      }

    } catch (err) {
      // Manejo de errores de la petición
      console.error('Error en el login:', err);
      if (err.response) {
        // El servidor respondió con un status code fuera del rango 2xx
        if (err.response.status === 401 || err.response.status === 403) {
          setError('Correo electrónico o contraseña incorrectos.');
        } else {
          setError(`Error del servidor: ${err.response.status}`);
        }
      } else if (err.request) {
        // La petición se hizo pero no se recibió respuesta (ej. servidor caído)
        setError('No se pudo conectar con el servidor. Inténtalo más tarde.');
      } else {
        // Algo pasó al configurar la petición
        setError('Ocurrió un error inesperado.');
      }
    } finally {
      setLoading(false); // Termina la carga, haya éxito o error
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.loginContainer}>
        <img src={logo} alt="AquaNest Logo" className={styles.logo} />
        <h1 className={styles.title}>AquaNest</h1>
        <h2 className={styles.subtitle}>Bienvenido!</h2>

        {/* Muestra el mensaje de error si existe */}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        <form onSubmit={handleLogin}>
          <div className={styles.formGroup}>
            {/* Cambiamos label y htmlFor a 'email' */}
            <label htmlFor="email" className={styles.label}>Correo Electrónico</label>
            <input
              type="email" // Cambiado a tipo email
              id="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)} // Actualiza estado 'email'
              required
              placeholder="tu@correo.com" // Placeholder actualizado
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Contraseña</label>
            <input
              type="password"
              id="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="********"
            />
          </div>

          {/* Deshabilita el botón mientras carga */}
          <button type="submit" className={styles.loginButton} disabled={loading}>
            {loading ? 'Iniciando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className={styles.registerLink}>
          No tienes una cuenta?{' '}
          <Link to="/register">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;