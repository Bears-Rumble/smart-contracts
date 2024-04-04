# Bear Rumble 

This repository contains the BearRumble Token and BearRumble ICO Smart Contracts.

## Installation

To install and use the Bear Rumble project, follow these steps:

1. Clone the repository

2. Navigate to the project directory

3. Install the dependencies using npm:

    ```bash
    npm ci
    ```

4. Set up the development environment by creating a `.env` file and specifying the required environment variables. You can use the `.env.example` file as a template.

5. Compile the smart contracts:

    ```bash
    npx hardhat compile
    ```

6. Run the tests:

    ```bash
    npx hardhat test
    ```

7. Check the tests' coverage:

    ```bash
    npx hardhat coverage
    ```

8. Deploy the smart contracts to a local development network:

    ```bash
    npx hardhat run scripts/deploy.js --network localhost
    ```
