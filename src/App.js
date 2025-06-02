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
import HistoricalData from './views/HistoricalChart/HistoricalData'; 

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/ponds" element={<Ponds />} />
          <Route path="/dashboard/:pondId" element={<Dashboard />} />
        <Route path="/historical-data/:pondId" element={<HistoricalData />} />
          <Route path="/control-temperature/:pondId" element={<ControlTemperature />} />
          <Route path="/control-nitrate/:pondId" element={<ControlNitrate />} />
          <Route path="/" element={<Navigate replace to="/login" />} />
          <Route path="/species" element={<Species />} />
          <Route path="/settings" element={<SettingsLayout />}>
                <Route path="profile" element={<Account />} />
                <Route path="password" element={<Password />} /> 
                <Route index element={<Navigate to="profile" replace />} />
          </Route>
          
        </Routes>
      </div>
    </Router>
  );
}

export default App;