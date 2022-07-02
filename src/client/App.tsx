import React from 'react'
import { Link } from 'react-router-dom'
import { UserProvider } from './components/UserProvider'
import { Routes } from './route'

function App() {
    return (
        <div className="w-screen text-center mt-10">

            <nav className='mb-4 text-blue-600'>
                <Link to="/" className="mr-4">Home</Link>
                <Link to="/requestDemo" className="mr-4">Request</Link>
                <Link to="/authDemo">Auth</Link>
            </nav>

            <UserProvider>
                <Routes>
                    <Routes />
                </Routes>
            </UserProvider>
        </div>
    )
}

export default App
