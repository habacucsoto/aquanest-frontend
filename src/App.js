// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './views/Login/Login';
import Register from './views/Register/Register';
import Dashboard from './views/Dashboard/Dashboard';
import Ponds from './views/Ponds/Ponds';
import Species from './views/Species/Species';
import ControlTemperature from './views/ControlTemperature/ControlTemperature';
import ControlNitrate from './views/ControlNitrate/ControlNitrate';
import SettingsLayout from './views/Settings/SettingsLayout';
import Account from './views/Settings/Account';
import Password from './views/Settings/Password';   

function App() {
  // Aquí podrías añadir lógica para verificar si el usuario está autenticado
  // const isAuthenticated = checkAuth(); // Función de ejemplo

  return (
    <Router> {/* Envuelve toda la aplicación en el Router */}
      <div className="App">
        <Routes> {/* Define el contenedor de las rutas */}
          {/* Ruta para la página de Login */}
          <Route path="/login" element={<Login />} />

          {/* Ruta para la página de Registro */}
          <Route path="/register" element={<Register />} />


          <Route path="/ponds" element={<Ponds />} />

          {/* Ruta para el Dashboard */}
          {/* Más adelante protegeremos esta ruta para que solo usuarios logueados puedan acceder */}
          <Route path="/dashboard/:pondId" element={<Dashboard />} />

          <Route path="/control-temperature/:pondId" element={<ControlTemperature />} />
          <Route path="/control-nitrate/:pondId" element={<ControlNitrate />} />

          {/* Ruta por defecto */}
          {/* Si el usuario va a la raíz "/", redirige a "/login" */}
          <Route path="/" element={<Navigate replace to="/login" />} />

          {/* Podrías añadir una ruta catch-all para páginas no encontradas (404) */}
          {/* <Route path="*" element={<NotFoundPage />} /> */}

          <Route path="/species" element={<Species />} />


          <Route path="/settings" element={<SettingsLayout />}> {/* Layout como padre */}
                <Route path="profile" element={<Account />} />    {/* Ruta hija */}
                <Route path="password" element={<Password />} />   {/* Ruta hija */}
                {/* Redirección por defecto dentro de settings */}
                <Route index element={<Navigate to="profile" replace />} />
          </Route>
          
        </Routes>
      </div>
    </Router>
  );
}

export default App;