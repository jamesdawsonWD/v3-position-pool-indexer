import { createPublicClient, http, getContract, keccak256, encodePacked } from "viem";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { CHAIN_CONFIGS, getRpcUrl } from "./chains";
import * as dotenv from "dotenv";

dotenv.config();

const CACHE_DIR = join(__dirname, "../../.cache");
if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
}

const clients: Record<number, ReturnType<typeof createPublicClient>> = {};
const getClient = (chainId: number) => {
    if (!clients[chainId]) {
        clients[chainId] = createPublicClient({
            transport: http(getRpcUrl(chainId))
        });
    }
    return clients[chainId];
};

const getPositionPoolCachePath = (chainId: number): string =>
    join(CACHE_DIR, `positionPools_${chainId}.json`);

const positionPoolCache: Record<number, Record<string, string>> = {};

function loadPositionPoolCache(chainId: number): Record<string, string> {
    if (!positionPoolCache[chainId]) {
        const path = getPositionPoolCachePath(chainId);
        if (existsSync(path)) {
            try {
                positionPoolCache[chainId] = JSON.parse(readFileSync(path, "utf8"));
            } catch (e) {
                console.error(`Failed to parse position pool cache for chain ${chainId}`);
                positionPoolCache[chainId] = {};
            }
        } else {
            positionPoolCache[chainId] = {};
        }
    }
    return positionPoolCache[chainId];
}

function savePositionPoolCache(chainId: number): void {
    const path = getPositionPoolCachePath(chainId);
    writeFileSync(path, JSON.stringify(positionPoolCache[chainId], null, 2));
}

const NONFUNGIBLE_POSITION_MANAGER_ABI = [
    {
        name: "positions",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [
            { name: "nonce", type: "uint96" },
            { name: "operator", type: "address" },
            { name: "token0", type: "address" },
            { name: "token1", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "tickLower", type: "int24" },
            { name: "tickUpper", type: "int24" },
            { name: "liquidity", type: "uint128" },
            { name: "feeGrowthInside0LastX128", type: "uint256" },
            { name: "feeGrowthInside1LastX128", type: "uint256" },
            { name: "tokensOwed0", type: "uint128" },
            { name: "tokensOwed1", type: "uint128" }
        ]
    }
] as const;

export async function getPoolForPosition(
    tokenId: bigint,
    chainId: number,
    blockNumber: number
): Promise<{
    poolAddress: string;
    tickLower: number;
    tickUpper: number;
}> {
    const cache = loadPositionPoolCache(chainId);
    const idStr = tokenId.toString();

    const client = getClient(chainId);
    const config = CHAIN_CONFIGS[chainId];

    const manager = getContract({
        address: config.nonfungiblePositionManager as `0x${string}`,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        client
    });

    const pos = await manager.read.positions([tokenId], { blockNumber: BigInt(blockNumber) });
    const token0 = pos[2] as string;
    const token1 = pos[3] as string;
    const fee = pos[4] as number;
    const [sorted0, sorted1] =
        token0.toLowerCase() < token1.toLowerCase()
            ? [token0, token1]
            : [token1, token0];

    const salt = keccak256(
        encodePacked(["address", "address", "uint24"], [sorted0 as `0x${string}`, sorted1 as `0x${string}`, fee])
    );

    const poolAddress = `0x${keccak256(
        encodePacked(
            ["bytes1", "address", "bytes32", "bytes32"],
            ["0xff", config.factoryAddress as `0x${string}`, salt, config.poolInitCodeHash as `0x${string}`]
        )
    ).slice(-40)}`;

    cache[idStr] = poolAddress;
    savePositionPoolCache(chainId);

    return {
        poolAddress,
        tickLower: pos[5] as number,
        tickUpper: pos[6] as number
    };
}