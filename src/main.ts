import { AddressLookupTableAccount, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, RpcResponseAndContext, SignatureResult, Signer, SystemProgram, TransactionBlockhashCtor, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { types, transactions, instructions, utils, accounts, getProgramConfigPda, getVaultPda, getMultisigPda } from "@sqds/multisig";
import { airdrop } from '../functions';
import Decimal from 'decimal.js';
import { ReviewerMultisig, RewardResults, signTransaction } from './ReviewerMultisig';

const connection = new Connection("http://localhost:8899", "confirmed");

const createKey = Keypair.generate();
const creatorKey = Keypair.generate();
const newMemberKey = Keypair.generate();

const secondMember = Keypair.generate();
const members = [{
    key: creatorKey.publicKey,
    permissions: types.Permissions.all(),
},
{
    key: secondMember.publicKey,
    permissions: types.Permissions.fromPermissions([types.Permission.Vote]),
},
];


function createRewardResultsArray(numKeys: number): RewardResults[] {
    const rewardResultsArray: RewardResults[] = [];
    const maxSum = 0.05;

    // Generating RewardResults for each PublicKey
    for (let i = 0; i < numKeys; i++) {
        // Generating a Keypair
        const keypair = Keypair.generate();

        // Generating a random sum not bigger than 0.05
        const sum = Math.random() * maxSum;

        // Creating the RewardResults object
        const rewardResult: RewardResults = {
            wallet: keypair.publicKey.toString(),
            sum: sum,
            signature: "placeholder"
        };

        // Adding the RewardResults object to the array
        rewardResultsArray.push(rewardResult);
    }

    return rewardResultsArray;
}

export const main = async() => {
    const numKeys = 5; // Change this number as per your requirement

    // Creating an array of RewardResults using the generated keys
    const rewardResults: RewardResults[] = createRewardResultsArray(numKeys);

    const reviewerMultisig = new ReviewerMultisig(connection, createKey, creatorKey.publicKey);

    { // create multisig
        await airdrop(connection, creatorKey.publicKey, 5 * LAMPORTS_PER_SOL);

        const createMultisigInstruction = await reviewerMultisig.CreateMultisigInstruction(1, members, 0);

        console.log("vault : ", reviewerMultisig.vaultPda.toString());
            const transferInstruction = SystemProgram.transfer({
                fromPubkey: creatorKey.publicKey,
                toPubkey: reviewerMultisig.vaultPda,
                lamports: 1 * LAMPORTS_PER_SOL,
            });

            const transactionMessage = new TransactionMessage({
                payerKey: creatorKey.publicKey,
                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                instructions: [
                    transferInstruction,
                    createMultisigInstruction,
                    new TransactionInstruction({
                        keys: [{ pubkey: creatorKey.publicKey, isSigner: true, isWritable: false }],
                        data: Buffer.from(`User ${creatorKey.publicKey.toString()} has added document with deposit 1 SOL.`, 'utf-8'),
                        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
                    })
                ],
            }).compileToV0Message();

            const transaction = new VersionedTransaction(transactionMessage);
            transaction.sign([createKey]);
            const sig = await signTransaction(creatorKey, transaction);
            const transactionSignature = await connection.sendTransaction(transaction);
            const signatureResult = await connection.confirmTransaction(transactionSignature, "confirmed");
    }
    {//add member
            const addMemberInstructions = await reviewerMultisig.AddMemberInstructions({  key: newMemberKey.publicKey,
                permissions: types.Permissions.fromPermissions([types.Permission.Initiate]),
            });
            console.log(`Add member ${newMemberKey.publicKey.toString()} to multisig`)

            const transactionMessage = new TransactionMessage({
                payerKey: creatorKey.publicKey,
                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                instructions: [
                    ...addMemberInstructions,
                    new TransactionInstruction({
                        keys: [{ pubkey: creatorKey.publicKey, isSigner: true, isWritable: false }],
                        data: Buffer.from(`User ${newMemberKey.publicKey.toString()} was added to multisig ${reviewerMultisig.multisigPda.toString()}.`, 'utf-8'),
                        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
                    })
                ],
            }).compileToV0Message();

            const transaction = new VersionedTransaction(transactionMessage);
            const sig = await signTransaction(creatorKey, transaction);
            const transactionSignature = await connection.sendTransaction(transaction);
            const signatureResult = await connection.confirmTransaction(transactionSignature, "confirmed");

            console.log(await reviewerMultisig.GetMultisigMembers());
    }
    {// remove member
        const addMemberInstructions = await reviewerMultisig.RemoveMemberInstructions(newMemberKey.publicKey);
        console.log(`Remove member ${newMemberKey.publicKey.toString()} from multisig`)

        const transactionMessage = new TransactionMessage({
            payerKey: creatorKey.publicKey,
            recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
            instructions: [
                ...addMemberInstructions,
                new TransactionInstruction({
                    keys: [{ pubkey: creatorKey.publicKey, isSigner: true, isWritable: false }],
                    data: Buffer.from(`User ${newMemberKey.publicKey.toString()} was removed from multisig ${reviewerMultisig.multisigPda.toString()}.`, 'utf-8'),
                    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
                })
            ],
        }).compileToV0Message();

        const transaction = new VersionedTransaction(transactionMessage);
        const sig = await signTransaction(creatorKey, transaction);
        const transactionSignature = await connection.sendTransaction(transaction);
        const signatureResult = await connection.confirmTransaction(transactionSignature, "confirmed");
        console.log(await reviewerMultisig.GetMultisigMembers());
    }
     {// transfer from vault
        const {prepareInstructions, transactionIndex} = await reviewerMultisig.PrepareTransferFromVaultToMultipleWalletsInstructions(rewardResults);
        console.log(`Transfer money from multisig`)

        const transactionMessage = new TransactionMessage({
            payerKey: creatorKey.publicKey,
            recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
            instructions: [
                ...prepareInstructions,
                new TransactionInstruction({
                    keys: [{ pubkey: creatorKey.publicKey, isSigner: true, isWritable: false }],
                    data: Buffer.from(`Prepare for sending money to reward receivers`, 'utf-8'),
                    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
                })
            ],
        }).compileToV0Message();

        const transaction = new VersionedTransaction(transactionMessage);
        const sig = await signTransaction(creatorKey, transaction);
        const transactionSignature = await connection.sendTransaction(transaction);
        const signatureResult = await connection.confirmTransaction(transactionSignature, "finalized");

        const transactionExecute = await reviewerMultisig.ExecuteVaultTransaction(transactionIndex);
        const sig2 = await signTransaction(creatorKey, transactionExecute);
        const transactionSignature2 = await connection.sendTransaction(transactionExecute);
        const signatureResult2 = await connection.confirmTransaction(transactionSignature2, "confirmed");
    }
}

main();