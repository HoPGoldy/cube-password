import React, { useState } from 'react'
import { Button } from 'react-vant'

const Home = () => {
    const [count, setCount] = useState(0)

    return (
        <div>
            <p className="text-2xl font-bold">Hello Vite + React!</p>
            <p className='mt-4'>
                <Button type="primary" onClick={() => setCount((count) => count + 1)}>
                    count is: {count}
                </Button>
            </p>
            <p className='mt-4'>
                Edit <code>App.tsx</code> and save to test HMR updates.
            </p>
        </div>
    )
}

export default Home