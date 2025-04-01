import { NonfungiblePositionManager, Position, Wallet } from "generated";
import { loadTransaction } from './utils/index';
import { ZERO_BI, ADDRESS_ZERO, } from './utils/constants';

NonfungiblePositionManager.Transfer.handlerWithLoader({
    loader: async ({ event, context }) => {
        const positionId = `${event.chainId}-${event.params.tokenId}`;
        const p = await Promise.all([context.Position.get(positionId), context.Wallet.get(event.params.to)])

        return [...p];
    },

    handler: async ({ event, context, loaderReturn }) => {
        if (!loaderReturn) return;

        const [
            positionRO,
            walletRO
        ] = loaderReturn as [Position, Wallet];

        const transaction = await loadTransaction(
            event.transaction.hash,
            event.block.number,
            event.block.timestamp,
            event.transaction.gasPrice || ZERO_BI,
            context
        );

        // If transaction is from zero address a new position is created
        const position = positionRO ? {
            ...positionRO,
            owner: event.params.to === ADDRESS_ZERO ? positionRO.owner_id : event.params.to,
            burned: event.params.to === ADDRESS_ZERO
        } : {
            id: `${event.chainId}-${event.params.tokenId}`,
            transaction_id: transaction.id,
            initialMintTimestamp: transaction.timestamp,
            lastUpdatedTimestamp: transaction.timestamp,
            collectedFeesToken0: ZERO_BI,
            collectedFeesToken1: ZERO_BI,
            liquidity: ZERO_BI,
            depositedToken0: ZERO_BI,
            depositedToken1: ZERO_BI,
            owner_id: event.params.to,
            burned: false
        }

        if(!walletRO) {
            context.Wallet.set({
                id: event.params.to
            })
        }

        context.Position.set(position);
    }
});
