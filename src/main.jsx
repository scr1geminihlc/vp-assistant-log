import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' /* <--- 這就是最關鍵的「穿上漂亮排版」的指令！ */

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
