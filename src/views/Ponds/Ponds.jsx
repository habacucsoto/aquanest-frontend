// src/views/Ponds/Ponds.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './Ponds.module.css';
import Layout from '../../views/Layout/Layout';
import pondIcon from '../../assets/Estanque.jpeg';
import { useNavigate } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';


const API_URL = 'http://localhost:8080'; // Ajusta si es diferente
const getAuthToken = () => localStorage.getItem('authToken');

function Ponds() {
  // Estados del formulario
  const [location, setLocation] = useState('');
  const [dimension, setDimension] = useState('');
  const [waterType, setWaterType] = useState('');
  const [selectedSpeciesId, setSelectedSpeciesId] = useState('');
  const [pondName, setPondName] = useState('');

  // --- Nuevos Estados para la lista de ESPECIES ---
  const [speciesList, setSpeciesList] = useState([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [speciesError, setSpeciesError] = useState('');
  // ---------------------------------------------

  // Estados para la lista de ESTANQUES
  const [pondsList, setPondsList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  // Estados para el formulario
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const navigate = useNavigate(); 

  const [deleteError, setDeleteError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // --- Función para obtener la lista de ESPECIES ---
  const fetchSpecies = async () => {
    setSpeciesLoading(true);
    setSpeciesError('');
    const token = getAuthToken();
    if (!token) {
      setSpeciesError("No autenticado.");
      setSpeciesLoading(false);
      return;
    }

    try {
      // Llamada GET a /especies
      const response = await axios.get(`${API_URL}/especies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpeciesList(response.data || []); // Guarda la lista o un array vacío
    } catch (err) {
      console.error("Error fetching species:", err);
      setSpeciesError("Error al cargar las especies disponibles.");
      // Manejar errores específicos (401/403)
    } finally {
      setSpeciesLoading(false);
    }
  };
  // ----------------------------------------------

  // --- Función para obtener la lista de ESTANQUES ---
  const fetchPonds = async () => {
    setListLoading(true);
    setListError('');
    const token = getAuthToken();
    if (!token) {
      setListError("No autenticado.");
      setListLoading(false);
      // Opcional: redirigir a login
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/estanques`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPondsList(response.data); // Asume que la respuesta es la lista directamente
    } catch (err) {
      console.error("Error fetching ponds:", err);
      setListError("Error al cargar la lista de estanques.");
      // Manejar errores específicos (401/403 si el token expiró, etc.)
    } finally {
      setListLoading(false);
    }
  };

  // --- Cargar AMBAS listas al montar el componente ---
  useEffect(() => {
    fetchPonds();
    fetchSpecies(); // <-- Llama también a fetchSpecies
  }, []); // Array vacío = ejecutar solo una vez al montar
  // ---------------------------------------------------

  const handlePondClick = (pondId) => {
    console.log(`Navegando al dashboard del estanque con ID: ${pondId}`);
    navigate(`/dashboard/${pondId}`); // Navega a la ruta con el ID
  };

  // --- Función para crear un estanque ---
  const handleCreatePond = async (event) => {
    event.preventDefault();
    setFormLoading(true);
    setFormError('');
    const token = getAuthToken();
    if (!token) {
      setFormError("No autenticado.");
      setFormLoading(false);
      return;
    }

    if (!selectedSpeciesId) {
      setFormError("Debes seleccionar una especie.");
      setFormLoading(false);
      return;
    }
    const especieIdToSend = parseInt(selectedSpeciesId, 10);

    const newPondData = {
      nombre: pondName,
      ubicacion: location,
      dimensiones: dimension,
      tipoAgua: waterType,
      especieId: especieIdToSend
    };

    console.log('Enviando para crear estanque:', newPondData);

    try {
      const response = await axios.post(`${API_URL}/estanques`, newPondData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Estanque creado:', response.data);
      // Limpiar formulario
      setPondName('');
      setLocation('');
      setDimension('');
      setWaterType('');
      setSelectedSpeciesId('');
      // Actualizar la lista de estanques
      await fetchPonds();

    } catch (err) {
      console.error("Error creando estanque:", err);
      if (err.response) {
        setFormError(`Error del servidor: ${err.response.status}. Verifica los datos.`);
        // Manejar errores específicos de validación si la API los devuelve
      } else {
        setFormError("Error de red o servidor no responde.");
      }
    } finally {
      setFormLoading(false);
    }
  };

      // --- Función para Eliminar Estanque ---
      const handleDeletePond = async (event, pondId, pondName) => {
        event.stopPropagation(); // <-- MUY IMPORTANTE: Evita que se active el clic de la tarjeta (handlePondClick)
        setDeleteError(''); // Limpia error previo

        // --- Confirmación ---
        if (!window.confirm(`¿Estás seguro de que deseas eliminar el estanque "${pondName}"? Esta acción no se puede deshacer.`)) {
            return; // No hacer nada si el usuario cancela
        }
        // --------------------

        setDeletingId(pondId); // Marca este ID como "eliminando"
        const token = getAuthToken();
        if (!token) {
            setDeleteError("Error de autenticación al eliminar.");
            setDeletingId(null);
            return;
        }

        try {
            // Llamada DELETE a la API
            await axios.delete(`${API_URL}/estanques/${pondId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(`Estanque ${pondId} eliminado.`);
            // Refresca la lista de estanques para quitar el eliminado
            await fetchPonds();

        } catch (err) {
            console.error(`Error eliminando estanque ${pondId}:`, err);
            if (err.response) {
                setDeleteError(`Error ${err.response.status} al eliminar el estanque.`);
            } else {
                 setDeleteError("Error de red al intentar eliminar.");
            }
            // Podrías mostrar este error cerca de la lista o con un toast/modal
        } finally {
            setDeletingId(null); // Termina el estado de eliminación para este ID
        }
    };

  // Handler para Radios de Especies
  const handleSpeciesChange = (event) => {
    setSelectedSpeciesId(event.target.value);
  };

  // Handler para otros radios/checkboxes
  const handleCheckboxChange = (setter) => (event) => {
    setter(event.target.value);
  };

  return (
    <Layout>
      <div className={styles.header}>
        <h1 className={styles.title}>Gestión de estanques</h1>
      </div>

      <div className={styles.contentWrapper}>
        {/* Sección: Formulario */}
        <div className={styles.formContainer}>
          <h2 className={styles.sectionTitle}>Nuevo estanque</h2>
          {formError && <p style={{ color: 'red' }}>{formError}</p>}
          <form onSubmit={handleCreatePond}>
            {/* Campo Nombre */}
            <div className={styles.formGroup}>
              <label htmlFor="pondName" className={styles.label}>Nombre del estanque</label>
              <input
                type="text"
                id="pondName"
                className={styles.input}
                value={pondName}
                onChange={(e) => setPondName(e.target.value)}
                required
              />
            </div>
            {/* Locación */}
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Ubicación</legend>
              <div className={styles.radioGroup}>
                <input
                  type="radio"
                  id="location-norte"
                  name="location"
                  value="Zona norte"
                  className={styles.radioInput}
                  checked={location === 'Zona norte'}
                  onChange={handleCheckboxChange(setLocation)}
                />
                <label htmlFor="location-norte">Zona norte</label>
              </div>
              <div className={styles.radioGroup}>
                <input
                  type="radio"
                  id="location-este"
                  name="location"
                  value="Zona este"
                  className={styles.radioInput}
                  checked={location === 'Zona este'}
                  onChange={handleCheckboxChange(setLocation)}
                />
                <label htmlFor="location-este">Zona este</label>
              </div>
              <div className={styles.radioGroup}>
                <input
                  type="radio"
                  id="location-oeste"
                  name="location"
                  value="Zona oeste"
                  className={styles.radioInput}
                  checked={location === 'Zona oeste'}
                  onChange={handleCheckboxChange(setLocation)}
                />
                <label htmlFor="location-oeste">Zona oeste</label>
              </div>
              <div className={styles.radioGroup}>
                <input
                  type="radio"
                  id="location-sur"
                  name="location"
                  value="Zona sur"
                  className={styles.radioInput}
                  checked={location === 'Zona sur'}
                  onChange={handleCheckboxChange(setLocation)}
                />
                <label htmlFor="location-sur">Zona sur</label>
              </div>
            </fieldset>
            {/* Dimensiones */}
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Dimensiones</legend>
              <div className={styles.radioGroup}>
                <input
                  type="radio"
                  id="dimension-500"
                  name="dimension"
                  value="500m2"
                  className={styles.radioInput}
                  checked={dimension === '500m2'}
                  onChange={handleCheckboxChange(setDimension)}
                />
                <label htmlFor="dimension-500">500m2</label>
              </div>
              <div className={styles.radioGroup}>
                <input
                  type="radio"
                  id="dimension-700"
                  name="dimension"
                  value="700m2"
                  className={styles.radioInput}
                  checked={dimension === '700m2'}
                  onChange={handleCheckboxChange(setDimension)}
                />
                <label htmlFor="dimension-700">700m2</label>
              </div>
              <div className={styles.radioGroup}>
                <input
                  type="radio"
                  id="dimension-900"
                  name="dimension"
                  value="900m2"
                  className={styles.radioInput}
                  checked={dimension === '900m2'}
                  onChange={handleCheckboxChange(setDimension)}
                />
                <label htmlFor="dimension-900">900m2</label>
              </div>
              <div className={styles.radioGroup}>
                <input
                  type="radio"
                  id="dimension-1000"
                  name="dimension"
                  value="1000m2"
                  className={styles.radioInput}
                  checked={dimension === '1000m2'}
                  onChange={handleCheckboxChange(setDimension)}
                />
                <label htmlFor="dimension-1000">1000m2</label>
              </div>
            </fieldset>
            {/* Tipo de agua */}
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Tipo de agua</legend>
              <div className={styles.radioGroup}>
                <input
                  type="radio"
                  id="waterType-dulce"
                  name="waterType"
                  value="Dulce"
                  className={styles.radioInput}
                  checked={waterType === 'Dulce'}
                  onChange={handleCheckboxChange(setWaterType)}
                />
                <label htmlFor="waterType-dulce">Agua Dulce</label>
              </div>
              <div className={styles.radioGroup}>
                <input
                  type="radio"
                  id="waterType-salada"
                  name="waterType"
                  value="Salada"
                  className={styles.radioInput}
                  checked={waterType === 'Salada'}
                  onChange={handleCheckboxChange(setWaterType)}
                />
                <label htmlFor="waterType-salada">Agua Salada</label>
              </div>
            </fieldset>

            {/* --- Especie (Ahora con lista dinámica) --- */}
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Especie</legend>
              {speciesLoading ? (
                <p>Cargando especies...</p>
              ) : speciesError ? (
                <p style={{ color: 'red' }}>{speciesError}</p>
              ) : speciesList.length > 0 ? (
                // Mapea sobre la lista obtenida de la API
                speciesList.map(specie => (
                  <div key={specie.id} className={styles.radioGroup}>
                    <input
                      type="radio"
                      id={`specie-${specie.id}`}
                      name="selectedSpecies"
                      value={specie.id} // El valor es el ID de la especie
                      className={styles.radioInput}
                      checked={selectedSpeciesId === String(specie.id)} // Compara con el ID seleccionado
                      onChange={handleSpeciesChange}
                    />
                    {/* Muestra el nombre de la especie */}
                    <label htmlFor={`specie-${specie.id}`}>{specie.nombre}</label>
                  </div>
                ))
              ) : (
                // Mensaje si no hay especies creadas por el usuario
                <p className={styles.placeholderText}>No hay especies creadas. Crea una especie primero.</p>
              )}
            </fieldset>
            {/* --------------------------------------- */}

            <button type="submit" className={styles.createButton} disabled={formLoading || speciesLoading || speciesList.length === 0}>
              {formLoading ? 'Creando...' : 'Crear estanque'}
            </button>
          </form>
        </div>

        {/* Sección: Lista de Estanques */}
        <div className={styles.listContainer}>
          <h2 className={styles.sectionTitle}>Mis estanques</h2>
          {listLoading && <p>Cargando estanques...</p>}
          {listError && <p style={{ color: 'red' }}>{listError}</p>}
          {deleteError && <p style={{ color: 'red', fontWeight: 'bold' }}>{deleteError}</p>} {/* Mostrar error de eliminación */}
          {!listLoading && !listError && (
            <div className={styles.pondsGrid}>
              {pondsList.length === 0 ? (
                <p className={styles.placeholderText}>Aún no has creado ningún estanque.</p>
              ) : (
                pondsList.map(pond => (
                <div
                    key={pond.id}
                    className={styles.pondCard} // Asegúrate que pondCard tenga cursor: pointer en CSS
                    onClick={() => handlePondClick(pond.id)} // Llama al handler con el ID
                  >
                  <button
                    className={styles.deleteButton}
                    onClick={(e) => handleDeletePond(e, pond.id, pond.nombre)} // Pasar evento, id y nombre
                    disabled={deletingId === pond.id} // Deshabilitar mientras se elimina
                    aria-label={`Eliminar estanque ${pond.nombre}`} // Para accesibilidad
                  >
                  {deletingId === pond.id ? '...' : <FaTimes />} {/* Icono X o indicador de carga */}
                  </button>
                    <img
                      src={pondIcon}
                      alt="Icono de estanque"
                      className={styles.pondIcon}
                    />
                    <div className={styles.pondCardInfo}>
                      <h3 className={styles.pondCardTitle}>{pond.nombre || 'Estanque sin nombre'}</h3>
                      <p className={styles.pondCardDetail}>Ubicación: {pond.ubicacion || 'N/A'}</p>
                      <p className={styles.pondCardDetail}>Dimensiones: {pond.dimensiones || 'N/A'}</p>
                      <p className={styles.pondCardDetail}>Tipo de agua: {pond.tipoAgua || 'N/A'}</p>
                      <p className={styles.pondCardDetail}>Especie: {pond.especie?.nombre || 'N/A'}</p>
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

export default Ponds;