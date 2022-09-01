import React from 'react'
import ReactDOM from 'react-dom'
import './styles/index.css'
import App from './App'
import { BrowserRouter } from './Route'

ReactDOM.render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
    document.getElementById('root')
)
