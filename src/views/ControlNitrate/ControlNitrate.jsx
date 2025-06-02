import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../Layout/Layout';
import styles from './ControlNitrate.module.css';
import bombaRecirculadoraIcon from '../../assets/bombaagua.jpeg';
import arrowLeftIcon from '../../assets/arrow_left.png';
import axios from 'axios';
import mqtt from 'mqtt';

// Configuración del broker MQTT y API
const MQTT_BROKER_URL = 'ws://18.222.108.48:8083/mqtt';
const API_URL = 'http://localhost:8080';
const getAuthToken = () => localStorage.getItem('authToken');

const getActuatorPrefix = (type) => {
    switch (type?.toLowerCase()) {
        case 'bomba_recirculadora': return 'BR';
        case 'enfriador': return 'ENF';
        case 'calentador': return 'CAL';
        default: return '';
    }
};

function ControlNitrato() {
    const { pondId } = useParams();
    const [actuadorNitrato, setActuadorNitrato] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [nombreEstanque, setNombreEstanque] = useState('');

    const mqttClientRef = useRef(null);
    const activeSubscriptionTopicRef = useRef(null);

    const [mqttConnected, setMqttConnected] = useState(false);

    const setActuadorNitratoRef = useRef(setActuadorNitrato);

    useEffect(() => {
        setActuadorNitratoRef.current = setActuadorNitrato;
    }, [setActuadorNitrato]);

    useEffect(() => {
        const client = mqtt.connect(MQTT_BROKER_URL);
        mqttClientRef.current = client;

        client.on('connect', () => {
            console.log('[MQTT_CLIENT - ControlNitrato] Conectado al broker MQTT.');
            setMqttConnected(true);
        });

        client.on('error', (err) => {
            console.error('[MQTT_CLIENT - ControlNitrato] Error de conexión MQTT:', err);
            setError(prevError => `${prevError} Error de conexión MQTT: ${err.message}`.trim());
            setMqttConnected(false);
        });

        client.on('close', () => {
            console.log('[MQTT_CLIENT - ControlNitrato] Desconectado del broker MQTT.');
            setMqttConnected(false);
        });

        const handleMqttMessage = (topic, message) => {
            const messageString = message.toString();

            const currentSubscriptionTopic = activeSubscriptionTopicRef.current;
            const currentSetActuadorNitrato = setActuadorNitratoRef.current;
            const normalizedMessage = messageString.toUpperCase();

            if (currentSubscriptionTopic && topic === currentSubscriptionTopic) {
                if (normalizedMessage === 'ON' || normalizedMessage === 'OFF') {
                    currentSetActuadorNitrato(prev => {
                        if (prev && prev.estado !== normalizedMessage) {
                            return { ...prev, estado: normalizedMessage };
                        }
                        return prev;
                    });
                    setError(prev => prev.replace(/Error al enviar el comando MQTT.*?(\.|$)/i, '').trim());
                } else {
                    console.warn(`[MQTT_STATE_UPDATE - ControlNitrato] Recibido payload inesperado en ${topic}: ${messageString}`);
                }
            } 
        };

        client.on('message', handleMqttMessage);
        return () => {
            if (mqttClientRef.current) {
                mqttClientRef.current.off('message', handleMqttMessage);

                if (activeSubscriptionTopicRef.current) {
                    mqttClientRef.current.unsubscribe(activeSubscriptionTopicRef.current);
                }

                mqttClientRef.current.end(true, () => {
                });
                mqttClientRef.current = null;
                activeSubscriptionTopicRef.current = null;
            }
        };
    }, []);


    useEffect(() => {
        const fetchActuadorNitrato = async () => {
            setLoading(true);
            setError('');
            setActuadorNitrato(null);
            setNombreEstanque('');

            const token = getAuthToken();
            if (!token) {
                setError("No autenticado.");
                setLoading(false);
                return;
            }

            try {
                const pondResponse = await axios.get(`${API_URL}/estanques/${pondId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const pondData = pondResponse.data;
                setNombreEstanque(pondData.nombre || 'Estanque Sin Nombre');

                const recirculador = pondData?.actuadores?.find(
                    (actuador) => actuador.tipo === "bomba_recirculadora"
                );

                if (recirculador) {
                    setActuadorNitrato(recirculador);
                } else {
                    setError("No se encontró el actuador de la bomba recirculadora para este estanque.");
                }
            } catch (err) {
                console.error("Error fetching actuador de nitrato:", err);
                if (err.response) {
                    setError(`Error al cargar la información: ${err.response.status} ${err.response.data?.message || ''}`);
                } else {
                    setError("Error de red o servidor no responde.");
                }
            } finally {
                setLoading(false);
            }
        };

        if (pondId) {
            fetchActuadorNitrato();
        } else {
            setError("ID de estanque no especificado.");
            setLoading(false);
        }
    }, [pondId]);

    useEffect(() => {
        const client = mqttClientRef.current;
        if (!client || !mqttConnected || !actuadorNitrato || !pondId || loading) {
            return;
        }

        const actuatorPrefix = getActuatorPrefix(actuadorNitrato.tipo);
        const actuatorIdentifier = actuatorPrefix ? `${actuatorPrefix}${actuadorNitrato.id}` : `${actuadorNitrato.id}`;
        const newResponseTopic = `aquanest/E${pondId}/${actuatorIdentifier}/response`;
        const currentStoredTopic = activeSubscriptionTopicRef.current;

        if (currentStoredTopic && currentStoredTopic !== newResponseTopic) {
            client.unsubscribe(currentStoredTopic, err => {
                 if (err) console.error(`[MQTT_SUB_EFFECT - ControlNitrato] Error desuscribiéndose de ${currentStoredTopic}:`, err);
            });
        }

        if (newResponseTopic && currentStoredTopic !== newResponseTopic) {
            client.subscribe(newResponseTopic, { qos: 0 }, err => {
                if (err) {
                    console.error(`[MQTT_SUB_EFFECT - ControlNitrato] Error suscribiéndose a ${newResponseTopic}:`, err);
                    setError(prevError => `${prevError} Error al suscribir a ${newResponseTopic}.`.trim());
                } else {
                    activeSubscriptionTopicRef.current = newResponseTopic;
                }
            });
        } else if (!newResponseTopic) {
            activeSubscriptionTopicRef.current = null;
        } else {
            console.log(`[MQTT_SUB_EFFECT - ControlNitrato] Tópico para Nitrato ya suscrito y no ha cambiado: ${currentStoredTopic}`); // Nuevo log si el tópico ya está suscrito
        }

        return () => {
        };
    }, [actuadorNitrato, pondId, loading, mqttConnected]);


    const handleEstadoChange = async () => {
        if (!actuadorNitrato || actuadorNitrato.estado === '...') {
            return;
        }

        const nuevoEstado = actuadorNitrato.estado === 'ON' ? 'OFF' : 'ON';
        const originalEstado = actuadorNitrato.estado;
        setActuadorNitrato(prev => ({ ...prev, estado: '...' }));

        const client = mqttClientRef.current;
        if (!client || !client.connected) {
            setError("Error: Cliente MQTT no conectado. No se pudo enviar el comando al actuador.");
            setActuadorNitrato(prev => ({ ...prev, estado: originalEstado }));
            return;
        }

        const actuatorPrefix = getActuatorPrefix(actuadorNitrato.tipo);
        const actuatorIdentifier = actuatorPrefix ? `${actuatorPrefix}${actuadorNitrato.id}` : `${actuadorNitrato.id}`;
        const actionTopic = `aquanest/E${pondId}/${actuatorIdentifier}/action`;
        const payload = nuevoEstado;

        client.publish(actionTopic, payload, { qos: 0 }, (err) => {
            if (err) {
                setError("Error al enviar el comando MQTT.");
                setActuadorNitrato(prev => ({ ...prev, estado: originalEstado }));
            } else {
                console.log(`[MQTT - ControlNitrato] Comando MQTT publicado exitosamente para actuador ${actuatorIdentifier}.`);
            }
        });
    };

    const buttonText = actuadorNitrato?.estado === 'ON' ? 'ON' : (actuadorNitrato?.estado === 'OFF' ? 'OFF' : '...');
    const isPending = actuadorNitrato?.estado === '...';

    useEffect(() => {
        console.log("[DEBUG_STATE - ControlNitrato] Estado actual del Actuador Nitrato:", actuadorNitrato?.estado);
    }, [actuadorNitrato]);


    return (
        <Layout>
            <Link to={`/dashboard/${pondId}`} className={styles.backToDashboardButton}>
                <img src={arrowLeftIcon} alt="Volver" className={styles.backIcon} />
                Volver
            </Link>
            <h1>Control de Bomba Recirculadora ({nombreEstanque || 'Cargando...'})</h1>
            <div className={styles.controlContainer}>
                <img
                    src={bombaRecirculadoraIcon}
                    alt="Bomba Recirculadora"
                    className={styles.controlImage}
                />
                {loading && <p>Cargando información del actuador...</p>}
                {error && <p className={styles.error}>{error}</p>}

                {!loading && !error.includes("No se encontró el actuador") && actuadorNitrato && (
                    <div className={styles.controlInfo}>
                        <p>{actuadorNitrato.tipo === 'bomba_recirculadora' ? 'Bomba Recirculadora' : actuadorNitrato.tipo}</p>
                        <div
                            className={`${styles.switchContainer} ${actuadorNitrato.estado === 'ON' ? styles.on : (actuadorNitrato.estado === 'OFF' ? styles.off : styles.pending)}`}
                            onClick={isPending ? null : handleEstadoChange}
                        >
                            <div className={styles.switchBackground}>
                                <span className={styles.switchText}>
                                    {buttonText}
                                </span>
                            </div>
                            <div className={styles.switchKnob}></div>
                        </div>
                    </div>
                )}
                {!loading && (error.includes("No se encontró el actuador") || (!actuadorNitrato && !error)) && (
                     <p className={styles.placeholderText}>No se encontró el actuador de nitrato para este estanque.</p>
                )}
            </div>
        </Layout>
    );
}

export default ControlNitrato;