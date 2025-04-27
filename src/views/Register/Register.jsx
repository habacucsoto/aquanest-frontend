import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Importa useNavigate
import axios from 'axios'; // Importa axios
import styles from './Register.module.css';
import logo from '../../assets/LogoAquaNest.png';

const API_URL = 'http://localhost:8080'; // Ajusta si es diferente

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState(''); // Estado para errores
  const [loading, setLoading] = useState(false); // Estado de carga
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });
  const navigate = useNavigate(); // Hook para navegar
    // --- useEffect para validar contraseña ---
    useEffect(() => {
      // Valida longitud (al menos 8 caracteres)
      const minLength = password.length >= 8;
      // Valida letra mayúscula
      const hasUppercase = /[A-Z]/.test(password);
      // Valida letra minúscula
      const hasLowercase = /[a-z]/.test(password);
      // Valida número
      const hasNumber = /[0-9]/.test(password);
      // Valida carácter especial (ajusta la expresión regular si tus caracteres son diferentes)
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
      // Actualiza el estado de validación
      setPasswordValidation({
        minLength,
        hasUppercase,
        hasLowercase,
        hasNumber,
        hasSpecialChar,
      });
    }, [password]); // Este efecto se ejecuta cada vez que el estado 'password' cambia

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    // Construye el objeto a enviar, basado en la entidad Usuario
    const userData = {
      nombre: nombre,
      email: email,
      password: password,
      // Incluye telefono solo si no está vacío
      ...(telefono && { telefono: telefono })
    };

    try {
      // Petición POST a /auth/register
      const response = await axios.post(`${API_URL}/auth/register`, userData);

      // Registro exitoso (status 201 Created)
      console.log('Registro exitoso:', response.data);
      // Opcional: Mostrar mensaje de éxito brevemente antes de redirigir
      // alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
      navigate('/login'); // Redirige a la página de Login

    } catch (err) {
      // Manejo de errores
      console.error('Error en el registro:', err);
      if (err.response) {
        if (err.response.status === 409) { // 409 Conflict (Email ya existe)
          setError('El correo electrónico ya está registrado.');
        } else {
          // Otros errores del servidor (ej. 400 Bad Request por validación)
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

        {/* Muestra el mensaje de error si existe */}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        <form onSubmit={handleRegister}>
          {/* Campo Nombre */}
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

          {/* Campo Email */}
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

          {/* Campo Teléfono (Opcional) */}
          <div className={styles.formGroup}>
            <label htmlFor="telefono" className={styles.label}>Teléfono</label>
            <input
              type="tel" // Tipo tel para semántica
              id="telefono"
              className={styles.input}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Tu número de teléfono"
            />
          </div>

          {/* Campo Contraseña */}
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
              {/* Icono dinámico */}
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

          {/* Deshabilita el botón mientras carga */}
          <button type="submit" className={styles.registerButton} disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Register;