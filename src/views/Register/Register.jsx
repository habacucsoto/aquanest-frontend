import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './Register.module.css';
import logo from '../../assets/LogoAquaNest.png';

const API_URL = 'http://localhost:8080';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });
  const navigate = useNavigate();
    useEffect(() => {
      const minLength = password.length >= 8;
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
      setPasswordValidation({
        minLength,
        hasUppercase,
        hasLowercase,
        hasNumber,
        hasSpecialChar,
      });
    }, [password]);

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const userData = {
      nombre: nombre,
      email: email,
      password: password,
      ...(telefono && { telefono: telefono })
    };

    try {
      const response = await axios.post(`${API_URL}/auth/register`, userData);
      navigate('/login');

    } catch (err) {
      if (err.response) {
        if (err.response.status === 409) {
          setError('El correo electrónico ya está registrado.');
        } else {
          setError(`Error del servidor: ${err.response.status}. Revisa los datos.`);
        }
      } else if (err.request) {
        setError('No se pudo conectar con el servidor. Inténtalo más tarde.');
      } else {
        setError('Ocurrió un error inesperado durante el registro.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.registerContainer}>
        <img src={logo} alt="AquaNest Logo" className={styles.logo} />
        <h2 className={styles.title}>Crea tu cuenta!</h2>
        <p className={styles.loginLink}>
          <Link to="/login">O Inicia sesión con tu cuenta</Link>
        </p>
        {error && <p style={{ color: 'red' }}>{error}</p>}

        <form onSubmit={handleRegister}>
          <div className={styles.formGroup}>
            <label htmlFor="nombre" className={styles.label}>Nombre Completo</label>
            <input
              type="text"
              id="nombre"
              className={styles.input}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Tu nombre completo"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>Correo electrónico</label>
            <input
              type="email"
              id="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@correo.com"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="telefono" className={styles.label}>Teléfono</label>
            <input
              type="tel"
              id="telefono"
              className={styles.input}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Tu número de teléfono"
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
              placeholder="Crea una contraseña segura"
            />
            <ul className={styles.passwordRequirements}>
            <li className={passwordValidation.minLength ? styles.valid : styles.invalid}>
              <span className={styles.icon}>{passwordValidation.minLength ? '✓' : '✗'}</span>
              Al menos 8 caracteres
            </li>
            <li className={passwordValidation.hasUppercase ? styles.valid : styles.invalid}>
              <span className={styles.icon}>{passwordValidation.hasUppercase ? '✓' : '✗'}</span>
              Una letra mayúscula
            </li>
            <li className={passwordValidation.hasLowercase ? styles.valid : styles.invalid}>
              <span className={styles.icon}>{passwordValidation.hasLowercase ? '✓' : '✗'}</span>
              Una letra minúscula
            </li>
            <li className={passwordValidation.hasNumber ? styles.valid : styles.invalid}>
              <span className={styles.icon}>{passwordValidation.hasNumber ? '✓' : '✗'}</span>
              Un número
            </li>
            <li className={passwordValidation.hasSpecialChar ? styles.valid : styles.invalid}>
              <span className={styles.icon}>{passwordValidation.hasSpecialChar ? '✓' : '✗'}</span>
              Un carácter especial (!@#$%^&amp;*(),.?":{}|&lt;&gt;)
            </li>
            </ul>
          </div>

          <button type="submit" className={styles.registerButton} disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Register;