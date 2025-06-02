import React, { useState, useEffect } from 'react';
import styles from './Settings.module.css';
import axios from 'axios';

const API_URL = 'http://localhost:8080';
const getAuthToken = () => localStorage.getItem('authToken');

function Account() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [success, setSuccess] = useState('');


  useEffect(() => {
    setLoading(true);
    axios.get(`${API_URL}/usuarios/me`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(response => {
        setName(response.data.nombre);
        setNewName(response.data.nombre);
        setEmail(response.data.email);
      })
      .catch(err => setError("Error al cargar datos del perfil"))
      .finally(() => setLoading(false));
  }, []);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setNewName(name);
  };

  const handleNameChange = (event) => {
    setNewName(event.target.value);
  };

  const handleSaveName = () => {
    setLoading(true);
    axios.patch(
      `${API_URL}/usuarios/me/name`,
      { nombre: newName },
      { headers: { Authorization: `Bearer ${getAuthToken()}` } }
    )
      .then(response => {
        setName(response.data.nombre);
        setIsEditing(false);
        setSuccess("Nombre actualizado correctamente.");
      })
      .catch(err => {
        setError("Error al actualizar el nombre");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className={styles.panelContent}>
      <h2>Perfil</h2>
      <p className={styles.panelDescription}>Esta información es pública, ten cuidado con lo que compartes.</p>

      {loading && <p>Cargando...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Nombre Completo</label>
        {success && <p className={styles.successMessage}>{success}</p>}
        {isEditing ? (
          <div>
            <input
              type="text"
              className={styles.inputField}
              value={newName}
              onChange={handleNameChange}
            />
            <div className={styles.editActions}>
              <button onClick={handleSaveName} className={styles.saveButton}>Guardar</button>
              <button onClick={handleCancelClick} className={styles.cancelButton}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className={styles.formValue}>{name}</div>
        )}
        {!isEditing && (
          <button onClick={handleEditClick} className={styles.updateButton}>Editar</button>
        )}
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Correo Electrónico</label>
        <div className={styles.formValue}>{email}</div>
      </div>
    </div>
  );
}

export default Account;