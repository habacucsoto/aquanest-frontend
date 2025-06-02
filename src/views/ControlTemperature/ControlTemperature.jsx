import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../Layout/Layout';
import styles from './ControlTemperature.module.css';
import calefactorIcon from '../../assets/calefactor.jpeg';
import enfriadorIcon from '../../assets/enfriador.jpeg';
import arrowLeftIcon from '../../assets/arrow_left.png';
import axios from 'axios';
import mqtt from 'mqtt';

const MQTT_BROKER_URL = 'ws://18.222.108.48:8083/mqtt';
const API_URL = 'http://localhost:8080';
const getAuthToken = () => localStorage.getItem('authToken');

const getActuatorPrefix = (type) => {
    switch (type?.toLowerCase()) {
        case 'calentador': return 'CAL';
        case 'enfriador': return 'ENF';
        case 'bomba_recirculadora': return 'BR';
        default: return '';
    }
};

function ControlTemperatura() {
    const { pondId } = useParams();
    const [actuadorCalentador, setActuadorCalentador] = useState(null);
    const [actuadorEnfriador, setActuadorEnfriador] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [nombreEstanque, setNombreEstanque] = useState('');

    const mqttClientRef = useRef(null);
    const activeSubscriptionsRef = useRef({ calentador: null, enfriador: null });

    const [mqttConnected, setMqttConnected] = useState(false);

    const setActuadorCalentadorRef = useRef(setActuadorCalentador);
    const setActuadorEnfriadorRef = useRef(setActuadorEnfriador);
    const activeSubscriptionsDataRef = useRef(activeSubscriptionsRef.current);

    useEffect(() => {
        setActuadorCalentadorRef.current = setActuadorCalentador;
        setActuadorEnfriadorRef.current = setActuadorEnfriador;
    }, [setActuadorCalentador, setActuadorEnfriador]);

    useEffect(() => {
        activeSubscriptionsDataRef.current = activeSubscriptionsRef.current;
        console.log('[DEBUG_REF] activeSubscriptionsDataRef updated:', activeSubscriptionsDataRef.current);
    }, [activeSubscriptionsRef.current.calentador, activeSubscriptionsRef.current.enfriador]);

    useEffect(() => {
        const client = mqtt.connect(MQTT_BROKER_URL);
        mqttClientRef.current = client;

        client.on('connect', () => {
            setMqttConnected(true);
        });

        client.on('error', (err) => {
            console.error('[MQTT_CLIENT - ControlTemperatura] Error de conexión MQTT:', err);
            setError(prevError => `${prevError} Error de conexión MQTT: ${err.message}`.trim());
            setMqttConnected(false);
        });

        client.on('close', () => {
            setMqttConnected(false);
        });

        const handleMqttMessage = (topic, message) => {
            const messageString = message.toString();

            const { calentador: calentadorTopic, enfriador: enfriadorTopic } = activeSubscriptionsDataRef.current;
            const currentSetCalentador = setActuadorCalentadorRef.current;
            const currentSetEnfriador = setActuadorEnfriadorRef.current;

            const normalizedMessage = messageString.toUpperCase();

            if (calentadorTopic && topic === calentadorTopic) {
                if (normalizedMessage === 'ON' || normalizedMessage === 'OFF') {
                    currentSetCalentador(prev => {
                        if (prev && prev.estado !== normalizedMessage) {
                            return { ...prev, estado: normalizedMessage };
                        }
                        return prev;
                    });
                    setError(prev => prev.replace(/Error al enviar el comando MQTT.*?(\.|$)/i, '').trim());
                } else {
                    console.warn(`[MQTT_STATE_WARN_CAL] Mensaje de calentador inválido: ${messageString}`);
                }
            } else if (enfriadorTopic && topic === enfriadorTopic) {
                if (normalizedMessage === 'ON' || normalizedMessage === 'OFF') {
                    currentSetEnfriador(prev => {
                        if (prev && prev.estado !== normalizedMessage) {
                            return { ...prev, estado: normalizedMessage };
                        }
                        return prev;
                    });
                    setError(prev => prev.replace(/Error al enviar el comando MQTT.*?(\.|$)/i, '').trim());
                } else {
                    console.warn(`[MQTT_STATE_WARN_ENF] Mensaje de enfriador inválido: ${messageString}`);
                }
            } else {
                console.log(`[MQTT_MESSAGE_UNHANDLED] Mensaje en tópico no gestionado: ${topic}`);
            }
        };

        client.on('message', handleMqttMessage);

        return () => {
            if (mqttClientRef.current) {
                mqttClientRef.current.off('message', handleMqttMessage);

                const { calentador, enfriador } = activeSubscriptionsRef.current;
                if (calentador) {
                    mqttClientRef.current.unsubscribe(calentador);
                }
                if (enfriador) {
                    mqttClientRef.current.unsubscribe(enfriador);
                }

                mqttClientRef.current.end(true, () => {
                });
                mqttClientRef.current = null;
                activeSubscriptionsRef.current = { calentador: null, enfriador: null };
            }
        };
    }, []); 

    useEffect(() => {
        const fetchActuadoresTemperatura = async () => {
            setLoading(true);
            setError('');
            setActuadorCalentador(null);
            setActuadorEnfriador(null);
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

                const calentador = pondData?.actuadores?.find(act => act.tipo === "calentador");
                const enfriador = pondData?.actuadores?.find(act => act.tipo === "enfriador");

                setActuadorCalentador(calentador);
                setActuadorEnfriador(enfriador);

                if (!calentador && !enfriador) {
                    setError("No se encontraron actuadores de Calentador ni Enfriador para este estanque.");
                } else if (!calentador) {
                    setError("No se encontró el actuador Calentador para este estanque.");
                } else if (!enfriador) {
                    setError("No se encontró el actuador Enfriador para este estanque.");
                }

            } catch (err) {
                console.error("Error fetching actuadores de temperatura:", err);
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
            fetchActuadoresTemperatura();
        } else {
            setError("ID de estanque no especificado.");
            setLoading(false);
        }
    }, [pondId]);


    useEffect(() => {
        const client = mqttClientRef.current;
        if (!client || !mqttConnected || !pondId || loading) {
            return;
        }
        const manageSingleSubscription = (actuator, actuatorTypeKey) => {
            let newTopicToSubscribe = null;
            if (actuator && actuator.id) {
                const prefix = getActuatorPrefix(actuator.tipo);
                const identifier = `${prefix}${actuator.id}`;
                newTopicToSubscribe = `aquanest/E${pondId}/${identifier}/response`;
            }

            const currentStoredTopic = activeSubscriptionsRef.current[actuatorTypeKey];

            if (currentStoredTopic !== newTopicToSubscribe) {
                if (currentStoredTopic) {
                    client.unsubscribe(currentStoredTopic, err => {
                        if (err) console.error(`[MQTT_SUB_TEMP] Error desuscribiéndose de ${currentStoredTopic}:`, err);
                    });
                }
                if (newTopicToSubscribe) {
                    client.subscribe(newTopicToSubscribe, { qos: 0 }, err => {
                        if (err) {
                            console.error(`[MQTT_SUB_TEMP] Error suscribiéndose a ${newTopicToSubscribe}:`, err);
                            setError(prevError => `${prevError} Error al suscribir a ${newTopicToSubscribe}.`.trim());
                        } else {
                            activeSubscriptionsRef.current[actuatorTypeKey] = newTopicToSubscribe;
                        }
                    });
                } else {
                    activeSubscriptionsRef.current[actuatorTypeKey] = null; // Actuador eliminado o sin ID
                }
            } else {
                console.log(`[MQTT_SUB_TEMP] Tópico para ${actuatorTypeKey} ya suscrito y no ha cambiado: ${currentStoredTopic}`);
            }
        };

        manageSingleSubscription(actuadorCalentador, 'calentador');
        manageSingleSubscription(actuadorEnfriador, 'enfriador');

        return () => {
        };
    }, [pondId, actuadorCalentador, actuadorEnfriador, loading, mqttConnected]);


    const handleEstadoChange = async (actuador, setActuatorState) => {
        if (!actuador || actuador.estado === '...') {
            return;
        }

        const nuevoEstado = actuador.estado === 'ON' ? 'OFF' : 'ON';
        const originalEstado = actuador.estado;
        setActuatorState(prev => ({ ...prev, estado: '...' }));
        const client = mqttClientRef.current;
        if (!client || !client.connected) {
            console.warn('[MQTT - ControlTemperatura] Cliente MQTT no conectado. No se pudo enviar el comando.');
            setError("Error: Cliente MQTT no conectado. No se pudo enviar el comando al actuador.");
            setActuatorState(prev => ({ ...prev, estado: originalEstado }));
            return;
        }

        const actuatorPrefix = getActuatorPrefix(actuador.tipo);
        const actuatorIdentifier = `${actuatorPrefix}${actuador.id}`;
        const actionTopic = `aquanest/E${pondId}/${actuatorIdentifier}/action`;

        client.publish(actionTopic, nuevoEstado, { qos: 0 }, (err) => {
            if (err) {
                setError("Error al enviar el comando MQTT.");
                setActuatorState(prev => ({ ...prev, estado: originalEstado }));
            } else {
            }
        });
    };

    const getSwitchProps = (actuator) => {
        const state = actuator?.estado;
        const isPending = state === '...';
        const className = `${styles.switchContainer} ${state === 'ON' ? styles.on : (state === 'OFF' ? styles.off : styles.pending)}`;
        const text = state === 'ON' ? 'ON' : (state === 'OFF' ? 'OFF' : '...');
        return { className, text, isPendingStatus: isPending };
    };

    useEffect(() => {
    }, [actuadorCalentador, actuadorEnfriador]);


    const hasCriticalError = error && !error.toLowerCase().includes("no se encontró el actuador");

    return (
        <Layout>
            <Link to={`/dashboard/${pondId}`} className={styles.backToDashboardButton}>
                <img src={arrowLeftIcon} alt="Volver" className={styles.backIcon} />
                Volver
            </Link>
            <h1>Control de Temperatura ({nombreEstanque || 'Cargando...'})</h1>

            {loading && <p>Cargando información de los actuadores...</p>}
            {hasCriticalError && <p className={styles.error}>{error}</p>}

            {!loading && !hasCriticalError && (actuadorCalentador || actuadorEnfriador) && (
                <div className={styles.controlsContainer}>
                    {actuadorCalentador ? (
                        <div className={styles.controlContainer}>
                            <img src={calefactorIcon} alt="Calentador" className={styles.controlImage} />
                            <div className={styles.controlInfo}>
                                <p>Calentador</p>
                                {(() => {
                                    const { className, text, isPendingStatus } = getSwitchProps(actuadorCalentador);
                                    return (
                                        <div
                                            className={className}
                                            onClick={isPendingStatus ? null : () => handleEstadoChange(actuadorCalentador, setActuadorCalentador)}
                                        >
                                            <div className={styles.switchBackground}>
                                                <span className={styles.switchText}>{text}</span>
                                            </div>
                                            <div className={styles.switchKnob}></div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    ) : (
                        !error.includes("Calentador ni Enfriador") && <div className={styles.controlContainer}><p className={styles.placeholderText}>Actuador Calentador no encontrado.</p></div>
                    )}

                    {actuadorEnfriador ? (
                        <div className={styles.controlContainer}>
                            <img src={enfriadorIcon} alt="Enfriador" className={styles.controlImage} />
                            <div className={styles.controlInfo}>
                                <p>Enfriador</p>
                                {(() => {
                                    const { className, text, isPendingStatus } = getSwitchProps(actuadorEnfriador);
                                    return (
                                        <div
                                            className={className}
                                            onClick={isPendingStatus ? null : () => handleEstadoChange(actuadorEnfriador, setActuadorEnfriador)}
                                        >
                                            <div className={styles.switchBackground}>
                                                <span className={styles.switchText}>{text}</span>
                                            </div>
                                            <div className={styles.switchKnob}></div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    ) : (
                        !error.includes("Calentador ni Enfriador") && <div className={styles.controlContainer}><p className={styles.placeholderText}>Actuador Enfriador no encontrado.</p></div>
                    )}
                </div>
            )}
            {!loading && !hasCriticalError && !actuadorCalentador && !actuadorEnfriador && (
                <p className={styles.placeholderText}>{error || "No se encontraron actuadores de temperatura."}</p>
            )}
        </Layout>
    );
}

export default ControlTemperatura;