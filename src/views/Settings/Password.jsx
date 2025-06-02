import React, { useState, useEffect } from 'react';
import styles from './Settings.module.css';
import axios from 'axios';

const API_URL = 'http://localhost:8080';
const getAuthToken = () => localStorage.getItem('authToken');

function Password() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  useEffect(() => {
    const minLength = newPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    setPasswordValidation({
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
    });
  }, [newPassword]);

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError("La nueva contraseña y la confirmación no coinciden.");
      return;
    }
    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("La nueva contraseña debe ser diferente a la actual.");
      return;
    }
    if (!passwordValidation.minLength || !passwordValidation.hasUppercase || !passwordValidation.hasLowercase || !passwordValidation.hasNumber || !passwordValidation.hasSpecialChar) {
      setError("La nueva contraseña no cumple con los requisitos de seguridad.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/auth/change-password`,
        { oldPassword: currentPassword, newPassword, confirmPassword },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      );
      if (response.status === 200) {
        setSuccess("Contraseña actualizada correctamente.");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError("Error al actualizar contraseña.");
      }
    } catch (err) {
      console.error("Error actualizando contraseña:", err);
      if (err.response && err.response.status === 401) {
        setError("La contraseña actual es incorrecta.");
      } else {
        setError("Error al actualizar contraseña. Inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.panelContent}>
      <h2>Ajustes de seguridad</h2>
      <p className={styles.panelDescription}>Asegúrate de tener una buena contraseña.</p>

      {error && <p className={styles.errorMessage}>{error}</p>}
      {success && <p className={styles.successMessage}>{success}</p>}

      <form onSubmit={handlePasswordUpdate}>
        <h3>Cambia tu contraseña</h3>
        <div className={styles.formGroup}>
          <label htmlFor="currentPassword" className={styles.label}>Contraseña actual</label>
          <input
            type="password"
            id="currentPassword"
            className={styles.input}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="newPassword" className={styles.label}>Nueva contraseña</label>
          <input
            type="password"
            id="newPassword"
            className={styles.input}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
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
              <span>Un carácter especial (!@#$%^&*(),.?":{}|)</span> {/* ENVOLVER EN SPAN */}
            </li>
          </ul>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword" className={styles.label}>Confirma tu contraseña</label>
          <input
            type="password"
            id="confirmPassword"
            className={styles.input}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <div className={styles.buttonGroup}>
          <button type="button" onClick={() => console.log("Cancelar")} className={styles.cancelButton}>
            Cancelar
          </button>
          <button type="submit" className={styles.submitButton} disabled={loading || !passwordValidation.minLength || !passwordValidation.hasUppercase || !passwordValidation.hasLowercase || !passwordValidation.hasNumber || !passwordValidation.hasSpecialChar || newPassword !== confirmPassword || newPassword.length < 8 || currentPassword === newPassword}>
            {loading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Password;