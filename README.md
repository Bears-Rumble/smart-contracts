# Bears Rumble 

This repository contains the BearsRumble Token and BearsRumble ICO Smart Contracts.

## Installation

To install and use the Bears Rumble project, follow these steps:

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


## ICO Contract

To correctly use the ICO contract, follow these steps:
- Deploy the Smart Contract with the wanted parameters. See the test file for example.
- Send the required amount of ERC20 tokens for each sale and for the referral system. You can send these tokens anytime between the contract deployement and the end of the cliff period. After, the contract has to have the necessary amount of tokens for the buyers to claim.
- Whitelist the desired buyers' addresses with the ```manageWhitelist``` function
- After each sale phase, end it to retrieve the funds with the ```endSale``` function
- After the end of the cliff period, buyers will be able to claim their tokens with the ```claimTokens``` function
- If a sale failed by not meeting the minimum amount set in the deployement, buyers can get a refund with the ```claimRefund``` function
