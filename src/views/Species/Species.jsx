import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './Species.module.css';
import Layout from '../../views/Layout/Layout';
import fishIcon from '../../assets/pez.jpeg';


const API_URL = 'http://localhost:8080';

const getAuthToken = () => localStorage.getItem('authToken');

function Species() {
  const [nombre, setNombre] = useState('');
  const [temperaturaOptimaMin, setTemperaturaOptimaMin] = useState('');
  const [temperaturaOptimaMax, setTemperaturaOptimaMax] = useState('');
  const [nitratoOptimoMin, setNitratoOptimoMin] = useState('');
  const [nitratoOptimoMax, setNitratoOptimoMax] = useState('');

  const [speciesList, setSpeciesList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchSpecies = async () => {
    setListLoading(true);
    setListError('');
    const token = getAuthToken();
    if (!token) {
      setListError("No autenticado.");
      setListLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/especies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpeciesList(response.data || []);
    } catch (err) {
      console.error("Error fetching species:", err);
      setListError("Error al cargar las especies.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecies();
  }, []);

  const handleCreateSpecies = async (event) => {
    event.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');
    const token = getAuthToken();
    if (!token) {
      setFormError("No autenticado.");
      setFormLoading(false);
      return;
    }

    const newSpeciesData = {
      nombre: nombre,
      temperaturaOptimaMin: parseFloat(temperaturaOptimaMin),
      temperaturaOptimaMax: parseFloat(temperaturaOptimaMax),
      nitrateOptimoMin: parseFloat(nitratoOptimoMin),
      nitrateOptimoMax: parseFloat(nitratoOptimoMax),
    };

    try {
      const response = await axios.post(`${API_URL}/especies`, newSpeciesData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFormSuccess(`Especie "${response.data.nombre}" creada con éxito.`);
      setNombre('');
      setTemperaturaOptimaMin('');
      setTemperaturaOptimaMax('');
      setNitratoOptimoMin('');
      setNitratoOptimoMax('');
      await fetchSpecies();

    } catch (err) {
      console.error("Error creando especie:", err);
      if (err.response) {
        setFormError(`Error del servidor: ${err.response.status}. Verifica los datos.`);
      } else {
        setFormError("Error de red o servidor no responde.");
      }
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <Layout>
      <div className={styles.header}>
        <h1 className={styles.title}>Gestión de especies</h1>
      </div>

      <div className={styles.contentWrapper}>
        <div className={styles.formContainer}>
          <h2 className={styles.sectionTitle}>Nueva especie</h2>
          {formError && <p className={styles.errorMessage}>{formError}</p>}
          {formSuccess && <p className={styles.successMessage}>{formSuccess}</p>}
          <form onSubmit={handleCreateSpecies}>
            <div className={styles.formGroup}>
              <label htmlFor="nombre" className={styles.label}>Nombre de la especie</label>
              <input
                type="text"
                id="nombre"
                className={styles.input}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="temperaturaOptimaMin" className={styles.label}>Temperatura óptima mínima (°C)</label>
              <input
                type="number"
                id="temperaturaOptimaMin"
                className={styles.input}
                value={temperaturaOptimaMin}
                onChange={(e) => setTemperaturaOptimaMin(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="temperaturaOptimaMax" className={styles.label}>Temperatura óptima máxima (°C)</label>
              <input
                type="number"
                id="temperaturaOptimaMax"
                className={styles.input}
                value={temperaturaOptimaMax}
                onChange={(e) => setTemperaturaOptimaMax(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="nitrateOptimoMin" className={styles.label}>Nitrato óptimo mínimo (ppm)</label>
              <input
                type="number"
                id="nitrateOptimoMin"
                className={styles.input}
                value={nitratoOptimoMin}
                onChange={(e) => setNitratoOptimoMin(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="nitrateOptimoMax" className={styles.label}>Nitrato óptimo máximo (ppm)</label>
              <input
                type="number"
                id="nitrateOptimoMax"
                className={styles.input}
                value={nitratoOptimoMax}
                onChange={(e) => setNitratoOptimoMax(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={styles.createButton} disabled={formLoading}>
              {formLoading ? 'Creando...' : 'Crear especie'}
            </button>
          </form>
        </div>
        <div className={styles.listContainer}>
          <h2 className={styles.sectionTitle}>Especies Creadas</h2>
          {listLoading && <p>Cargando especies...</p>}
          {listError && <p className={styles.errorMessage}>{listError}</p>}
          {!listLoading && !listError && (
            <div className={styles.speciesGrid}>
              {speciesList.length === 0 ? (
                <p className={styles.placeholderText}>Aún no has creado ninguna especie.</p>
              ) : (
                speciesList.map(specie => (
                    <div key={specie.id} className={styles.specieCard}>
                      <img
                        src={fishIcon}
                        alt="Icono de pez"
                        className={styles.fishIcon}
                      />
                      <div className={styles.speciesInfo}>
                        <h3 className={styles.speciesCardTitle}>{specie.nombre}</h3>
                        <p className={styles.speciesCardDetail}>Temperatura óptima: {specie.temperaturaOptimaMin}°C - {specie.temperaturaOptimaMax}°C</p>
                        <p className={styles.speciesCardDetail}>Nitrato óptimo: {specie.nitrateOptimoMin} ppm - {specie.nitrateOptimoMax} ppm</p>
                      </div>
                </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default Species;