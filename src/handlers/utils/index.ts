import { BigDecimal, handlerContext, Transaction } from "generated";
import { ZERO_BD, ONE_BD, ZERO_BI, ONE_BI } from "./constants";

export function exponentToBigDecimal(decimals: bigint): BigDecimal {
    let resultString = "1";

    for (let i = 0; i < Number(decimals); i++) {
        resultString += "0";
    }

    return new BigDecimal(resultString);
}

// return 0 if denominator is 0 in division
export function safeDiv(amount0: BigDecimal, amount1: BigDecimal): BigDecimal {
    return amount1.eq(ZERO_BD) ? ZERO_BD : amount0.div(amount1);
}

export function hexToBigInt(hex: string): bigint {
    if (hex.startsWith("0x")) {
        hex = hex.slice(2);
    }
    return BigInt(`0x${hex}`);
}

/**
 * Implements exponentiation by squaring
 * (see https://en.wikipedia.org/wiki/Exponentiation_by_squaring )
 * to minimize the number of BigDecimal operations and their impact on performance.
 */
export function fastExponentiation(
    value: BigDecimal,
    power: bigint
): BigDecimal {
    if (power < ZERO_BI) {
        const result = fastExponentiation(value, -power);
        return safeDiv(ONE_BD, result);
    }

    if (power == ZERO_BI) {
        return ONE_BD;
    }

    if (power == ONE_BI) {
        return value;
    }

    const halfPower = power / 2n;
    const halfResult = fastExponentiation(value, halfPower);

    // Use the fact that x ^ (2n) = (x ^ n) * (x ^ n) and we can compute (x ^ n) only once.
    let result = halfResult.times(halfResult);

    // For odd powers, x ^ (2n + 1) = (x ^ 2n) * x
    if (power % 2n === ONE_BI) {
        result = result.times(value);
    }

    return result;
}

const NULL_ETH_HEX_STRING =
    "0x0000000000000000000000000000000000000000000000000000000000000001";

export function isNullEthValue(value: string): boolean {
    return value === NULL_ETH_HEX_STRING;
}

export function createPoolAddress(chainId: number, address: string): string {
    return `${chainId}-${address.toLowerCase()}`
}

export function convertTokenToDecimal(
    tokenAmount: bigint,
    exchangeDecimals: bigint
): BigDecimal {
    if (exchangeDecimals === ZERO_BI) {
        return new BigDecimal(tokenAmount.toString());
    }
    return new BigDecimal(tokenAmount.toString()).div(
        exponentToBigDecimal(exchangeDecimals)
    );
}

export async function loadTransaction(
    txHash: string,
    blockNumber: number,
    timestamp: number,
    gasPrice: bigint,
    context: handlerContext
): Promise<Transaction> {
    const txRO = await context.Transaction.get(txHash);
    const transaction = txRO ? { ...txRO } :
        {
            id: txHash,
            blockNumber: 0,
            timestamp: 0,
            gasUsed: ZERO_BI, //needs to be moved to transaction receipt
            gasPrice: ZERO_BI
        };

    transaction.blockNumber = blockNumber;
    transaction.timestamp = timestamp;
    transaction.gasUsed = ZERO_BI; //needs to be moved to transaction receipt
    transaction.gasPrice = gasPrice;

    context.Transaction.set(transaction as Transaction);
    return transaction as Transaction;
}