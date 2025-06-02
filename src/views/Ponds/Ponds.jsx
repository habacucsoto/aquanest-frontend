import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import styles from './Ponds.module.css';
import Layout from '../../views/Layout/Layout';
import pondIcon from '../../assets/Estanque.jpeg';
import { useNavigate } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';
import mqtt from 'mqtt';

const MQTT_BROKER_URL = 'ws://18.222.108.48:8083/mqtt';

const API_URL = 'http://localhost:8080';
const getAuthToken = () => localStorage.getItem('authToken');

function Ponds() {
  const [location, setLocation] = useState('');
  const [dimension, setDimension] = useState('');
  const [waterType, setWaterType] = useState('');
  const [selectedSpeciesId, setSelectedSpeciesId] = useState('');
  const [pondName, setPondName] = useState('');

  const [speciesList, setSpeciesList] = useState([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [speciesError, setSpeciesError] = useState('');

  const [pondsList, setPondsList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteError, setDeleteError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const navigate = useNavigate();

  const mqttClientRef = useRef(null);

  useEffect(() => {
      const client = mqtt.connect(MQTT_BROKER_URL);

      client.on('connect', () => {
          console.log('[MQTT_CLIENT - Ponds] Conectado al broker MQTT.');
      });

      client.on('error', (err) => {
          console.error('[MQTT_CLIENT - Ponds] Error en conexión MQTT:', err);
      });

      client.on('close', () => {
           console.log('[MQTT_CLIENT - Ponds] Desconectado del broker MQTT.');
      });

      mqttClientRef.current = client;

      return () => {
          if (mqttClientRef.current) {
              mqttClientRef.current.end(true, () => {
              });
              mqttClientRef.current = null;
          }
      };
  }, []);


  const fetchSpecies = useCallback(async () => {
    setSpeciesLoading(true);
    setSpeciesError('');
    const token = getAuthToken();
    if (!token) {
      setSpeciesError("No autenticado.");
      setSpeciesLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/especies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpeciesList(response.data || []);
    } catch (err) {
      setSpeciesError("Error al cargar las especies disponibles.");
    } finally {
      setSpeciesLoading(false);
    }
  }, [setSpeciesLoading, setSpeciesError, setSpeciesList]);


  const fetchPonds = useCallback(async () => {
    setListLoading(true);
    setListError('');
    const token = getAuthToken();
    if (!token) {
      setListError("No autenticado.");
      setListLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/estanques`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPondsList(response.data);
    } catch (err) {
      console.error("Error fetching ponds:", err);
      setListError("Error al cargar la lista de estanques.");
    } finally {
      setListLoading(false);
    }
  }, [setListLoading, setListError, setPondsList]);


  useEffect(() => {
    fetchPonds();
    fetchSpecies();
  }, [fetchPonds, fetchSpecies]);


  const handlePondClick = (pondId) => {
    navigate(`/dashboard/${pondId}`);
  };

  const handleCreatePond = useCallback(async (event) => {
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

    try {
      const response = await axios.post(`${API_URL}/estanques`, newPondData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Estanque creado:', response.data);
      setPondName('');
      setLocation('');
      setDimension('');
      setWaterType('');
      setSelectedSpeciesId('');
      await fetchPonds();

    } catch (err) {
      console.error("Error creando estanque:", err);
      if (err.response) {
        setFormError(`Error del servidor: ${err.response.status}. Verifica los datos.`);
      } else {
        setFormError("Error de red o servidor no responde.");
      }
    } finally {
      setFormLoading(false);
    }
  }, [pondName, location, dimension, waterType, selectedSpeciesId, fetchPonds, setFormLoading, setFormError, setPondName, setLocation, setDimension, setWaterType, setSelectedSpeciesId]);


      const handleDeletePond = useCallback(async (event, pondId, pondName) => {
        event.stopPropagation();
        setDeleteError('');

        if (!window.confirm(`¿Estás seguro de que deseas eliminar el estanque "${pondName}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        setDeletingId(pondId);
        const token = getAuthToken();
        if (!token) {
            setDeleteError("Error de autenticación al eliminar.");
            setDeletingId(null);
            return;
        }

        try {
            await axios.delete(`${API_URL}/estanques/${pondId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(`Estanque ${pondId} eliminado vía API.`);
            const client = mqttClientRef.current;
            const deleteTopic = `aquanest/E${pondId}/delete`;
            const payload = '';

            if (client && client.connected) {
                client.publish(deleteTopic, payload, { qos: 0 }, (err) => {
                    if (err) {
                        console.error(`[MQTT_PUBLISH ERROR - Ponds] Error al publicar mensaje de eliminación para estanque ${pondId}:`, err);
                    } else {
                        console.log(`[MQTT - Ponds] Mensaje de eliminación publicado exitosamente para estanque ${pondId}.`);
                    }
                     fetchPonds();
                     setDeletingId(null);
                });
            } else {
                console.warn(`[MQTT - Ponds] Cliente MQTT no conectado. No se pudo publicar mensaje de eliminación para estanque ${pondId}.`);
                 setDeleteError("Estanque eliminado en DB, pero falló notificación MQTT.");
                 fetchPonds();
                 setDeletingId(null);
            }


        } catch (err) {
            if (err.response) {
                 const errorMessage = err.response.data?.message || `Error ${err.response.status} al eliminar el estanque.`;
                setDeleteError(errorMessage);
            } else {
                 setDeleteError("Error de red al intentar eliminar el estanque.");
            }
             setDeletingId(null);
        }
    }, [fetchPonds, setDeleteError, setDeletingId]);

  const handleSpeciesChange = (event) => {
    setSelectedSpeciesId(event.target.value);
  };

  const handleCheckboxChange = (setter) => (event) => {
    setter(event.target.value);
  };

  return (
    <Layout>
      <div className={styles.header}>
        <h1 className={styles.title}>Gestión de estanques</h1>
      </div>

      <div className={styles.contentWrapper}>
        <div className={styles.formContainer}>
          <h2 className={styles.sectionTitle}>Nuevo estanque</h2>
          {formError && <p style={{ color: 'red' }}>{formError}</p>}
          <form onSubmit={handleCreatePond}>
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

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Especie</legend>
              {speciesLoading ? (
                <p>Cargando especies...</p>
              ) : speciesError ? (
                <p style={{ color: 'red' }}>{speciesError}</p>
              ) : speciesList.length > 0 ? (
                speciesList.map(specie => (
                  <div key={specie.id} className={styles.radioGroup}>
                    <input
                      type="radio"
                      id={`specie-${specie.id}`}
                      name="selectedSpecies"
                      value={specie.id}
                      className={styles.radioInput}
                      checked={selectedSpeciesId === String(specie.id)}
                      onChange={handleSpeciesChange}
                    />
                    <label htmlFor={`specie-${specie.id}`}>{specie.nombre}</label>
                  </div>
                ))
              ) : (
                <p className={styles.placeholderText}>No hay especies creadas. Crea una especie primero.</p>
              )}
            </fieldset>

            <button type="submit" className={styles.createButton} disabled={formLoading || speciesLoading || speciesList.length === 0 || !pondName || !location || !dimension || !waterType || !selectedSpeciesId}>
              {formLoading ? 'Creando...' : 'Crear estanque'}
            </button>
          </form>
        </div>

        <div className={styles.listContainer}>
          <h2 className={styles.sectionTitle}>Mis estanques</h2>
          {listLoading && <p>Cargando estanques...</p>}
          {listError && <p style={{ color: 'red' }}>{listError}</p>}
          {deleteError && <p style={{ color: 'red', fontWeight: 'bold' }}>{deleteError}</p>}
          {!listLoading && !listError && (
            <div className={styles.pondsGrid}>
              {pondsList.length === 0 ? (
                <p className={styles.placeholderText}>Aún no has creado ningún estanque.</p>
              ) : (
                pondsList.map(pond => (
                <div
                    key={pond.id}
                    className={styles.pondCard}
                    onClick={() => handlePondClick(pond.id)}
                  >
                  <button
                    className={styles.deleteButton}
                    onClick={(e) => handleDeletePond(e, pond.id, pond.nombre)}
                    disabled={deletingId === pond.id}
                    aria-label={`Eliminar estanque ${pond.nombre}`}
                  >
                  {deletingId === pond.id ? '...' : <FaTimes />}
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