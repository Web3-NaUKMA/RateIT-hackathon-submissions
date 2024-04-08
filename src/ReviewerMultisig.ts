import { AddressLookupTableAccount, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, RpcResponseAndContext, SignatureResult, Signer, SystemProgram, TransactionBlockhashCtor, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { types, transactions, instructions, utils, accounts, getProgramConfigPda, getVaultPda, getMultisigPda } from "@sqds/multisig";
import { airdrop } from '../functions';
import Decimal from 'decimal.js';

export type RewardResults = {
    wallet: string;
    sum: number;
    signature: string;
}

export const signTransaction = (who : Keypair, transaction: VersionedTransaction) : VersionedTransaction => {
    transaction.sign([who]);
    return transaction;
}


export class ReviewerMultisig {
    connection          : Connection;
    multisigCreateKey   : Signer;
    multisigPda         : PublicKey;
    vaultPda            : PublicKey;
    programConfigPda    : PublicKey;
    creator             : PublicKey;

    constructor(connection : Connection, multisigCreateKey : Signer, creator : PublicKey) {
        this.connection = connection;
        this.multisigCreateKey = multisigCreateKey;
        this.creator = creator;

        this.multisigPda = getMultisigPda({
            createKey: multisigCreateKey.publicKey,
        })[0];

        this.vaultPda = getVaultPda({
            multisigPda: this.multisigPda,
            index: 0,
        })[0];

        this.programConfigPda = getProgramConfigPda({})[0];
    }

    async CreateMultisigInstruction(threshold: number, members : types.Member[], timeLock: number) : Promise<TransactionInstruction> {
        const programConfig = await accounts.ProgramConfig.fromAccountAddress(
            this.connection,
            this.programConfigPda
        );
        const configTreasury = programConfig.treasury;

        let createMultisigInstruction = instructions.multisigCreateV2(
            {
                treasury: configTreasury,
                createKey: this.multisigCreateKey.publicKey,
                creator : this.creator,
                multisigPda : this.multisigPda,
                configAuthority: null,
                threshold,
                members,
                timeLock,
                rentCollector: null,
            }
        );

        return createMultisigInstruction;
    }

    async AddMemberInstructions(member : types.Member) : Promise<TransactionInstruction[]>{
        let multisigAccount = await accounts.Multisig.fromAccountAddress(
            this.connection,
            this.multisigPda
        );

        const transactionIndex = utils.toBigInt(multisigAccount.transactionIndex) + 1n;

        const addMemberInstruction = instructions.configTransactionCreate(
            {
                creator : this.creator,
                rentPayer: this.creator,
                multisigPda : this.multisigPda,
                transactionIndex,
                actions: [{
                    __kind: "AddMember",
                    newMember: member
                }]
            }
        )

        const addMemberProposalInstruction = instructions.proposalCreate({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            creator: this.creator
        });


        const addMemberProposalApproveInstruction = instructions.proposalApprove({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator
        });

        const addMemberTransactionExecuteInstruction = instructions.configTransactionExecute({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator,
            rentPayer: this.creator
        })

        const addMemberInstructions : TransactionInstruction[] = [
            addMemberInstruction,
            addMemberProposalInstruction,
            addMemberProposalApproveInstruction,
            addMemberTransactionExecuteInstruction,
        ];

        return addMemberInstructions;
    }

    async AddMultipleMembersInstructions(newMembersPubKeys : PublicKey[]) : Promise<TransactionInstruction[]>{
        let multisigAccount = await accounts.Multisig.fromAccountAddress(
            this.connection,
            this.multisigPda
        );

        const transactionIndex = utils.toBigInt(multisigAccount.transactionIndex) + 1n;

        let newMembers : types.Member[] = [];

        newMembersPubKeys.forEach((memPubs) => {
            newMembers.push({
                key: memPubs,
                permissions: types.Permissions.fromPermissions([types.Permission.Initiate]),
            })
        })

        let configActions : types.ConfigAction[] = [];

        newMembers.forEach((mem) => {
            configActions.push({
                __kind: "AddMember",
                newMember : mem
            })
        });

        const addMemberInstruction = instructions.configTransactionCreate(
            {
                creator : this.creator,
                rentPayer: this.creator,
                multisigPda : this.multisigPda,
                transactionIndex,
                actions: configActions
            }
        )

        const addMemberProposalInstruction = instructions.proposalCreate({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            creator: this.creator
        });


        const addMemberProposalApproveInstruction = instructions.proposalApprove({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator
        });

        const addMemberTransactionExecuteInstruction = instructions.configTransactionExecute({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator,
            rentPayer: this.creator
        })

        const addMemberInstructions : TransactionInstruction[] = [
            addMemberInstruction,
            addMemberProposalInstruction,
            addMemberProposalApproveInstruction,
            addMemberTransactionExecuteInstruction,
        ];

        return addMemberInstructions;
    }

    async RemoveMemberInstructions(oldMember : PublicKey) : Promise<TransactionInstruction[]>{
        let multisigAccount = await accounts.Multisig.fromAccountAddress(
            this.connection,
            this.multisigPda
        );

        const transactionIndex = utils.toBigInt(multisigAccount.transactionIndex) + 1n;

        const removeMemberInstruction = instructions.configTransactionCreate(
            {
                creator : this.creator,
                rentPayer: this.creator,
                multisigPda : this.multisigPda,
                transactionIndex,
                actions: [{
                    __kind: "RemoveMember",
                    oldMember
                }]
            }
        )

        const removeMemberProposalInstruction = instructions.proposalCreate({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            creator: this.creator
        });

        const removeMemberProposalApproveInstruction =  instructions.proposalApprove({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator
        });

        const removeMemberTransactionExecuteInstruction = instructions.configTransactionExecute({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator,
            rentPayer: this.creator
        })

        const removeMemberInstructions : TransactionInstruction[] = [
            removeMemberInstruction,
            removeMemberProposalInstruction,
            removeMemberProposalApproveInstruction,
            removeMemberTransactionExecuteInstruction,
        ];

        return removeMemberInstructions;
    }

    async TransferFromVaultInstructions(otherVaultPda : PublicKey, lamports : number) : Promise<{prepareInstructions: TransactionInstruction[], executeTransaction: VersionedTransaction}>{
        let multisigAccount = await accounts.Multisig.fromAccountAddress(
            this.connection,
            this.multisigPda
        );

        const transactionIndex = utils.toBigInt(multisigAccount.transactionIndex) + 1n;

        const transferInstruction = SystemProgram.transfer({
            fromPubkey: this.vaultPda,
            toPubkey: otherVaultPda,
            lamports
        });

        const transactionMessage = new TransactionMessage({
            payerKey: this.vaultPda,
            instructions: [transferInstruction],
            recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash
        });

        const vaultTransactionInstruction = instructions.vaultTransactionCreate({
            multisigPda : this.multisigPda,
            transactionIndex,
            creator: this.creator,
            vaultIndex: 0,
            ephemeralSigners: 1,
            transactionMessage: transactionMessage,
            memo: `Transfer ${lamports} lamports to ${otherVaultPda.toBase58()}`
        });

        const vaultTransactionProposalInstruction = instructions.proposalCreate({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            creator: this.creator
        });

        const vaultTransactionProposalApproveInstruction =  instructions.proposalApprove({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator
        });

        const vaultPrepareInstructions : TransactionInstruction[] = [
            vaultTransactionInstruction,
            vaultTransactionProposalInstruction,
            vaultTransactionProposalApproveInstruction
        ];

        const vaultTransactionExecute = await transactions.vaultTransactionExecute({
            connection: this.connection,
            blockhash: (await this.connection.getLatestBlockhash()).blockhash,
            feePayer: this.creator,
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator
        });

        return {
            prepareInstructions : vaultPrepareInstructions,
            executeTransaction : vaultTransactionExecute
        };
    }

    async TransferFromVaultToMultipleMembersInstructions(members : PublicKey[], lamportsToEachMember : number) : Promise<{prepareInstructions: TransactionInstruction[], executeTransaction: VersionedTransaction}>{
        let multisigAccount = await accounts.Multisig.fromAccountAddress(
            this.connection,
            this.multisigPda
        );

        const transactionIndex = utils.toBigInt(multisigAccount.transactionIndex) + 1n;

        const transferInstructions : TransactionInstruction[] = [];

        members.forEach((receiver) => {
            transferInstructions.push(
                SystemProgram.transfer({
                    fromPubkey: this.vaultPda,
                    toPubkey: receiver,
                    lamports : lamportsToEachMember
                })
            )
        })

        const transactionMessage = new TransactionMessage({
            payerKey: this.vaultPda,
            instructions: transferInstructions,
            recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash
        });

        const vaultTransactionInstruction = instructions.vaultTransactionCreate({
            multisigPda : this.multisigPda,
            transactionIndex,
            creator: this.creator,
            vaultIndex: 0,
            ephemeralSigners: 1,
            transactionMessage: transactionMessage,
            memo: `Transfer ${lamportsToEachMember} lamports to\n${members.map((receiver) => {return receiver.toBase58().toString() + "\n"})}`
        });

        const vaultTransactionProposalInstruction = instructions.proposalCreate({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            creator: this.creator
        });

        const vaultTransactionProposalApproveInstruction =  instructions.proposalApprove({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator
        });

        const vaultPrepareInstructions : TransactionInstruction[] = [
            vaultTransactionInstruction,
            vaultTransactionProposalInstruction,
            vaultTransactionProposalApproveInstruction
        ];

        const vaultTransactionExecute = await transactions.vaultTransactionExecute({
            connection: this.connection,
            blockhash: (await this.connection.getLatestBlockhash()).blockhash,
            feePayer: this.creator,
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator
        });

        return {
            prepareInstructions : vaultPrepareInstructions,
            executeTransaction : vaultTransactionExecute
        };
    }

    async PrepareTransferFromVaultToMultipleWalletsInstructions(rewards : RewardResults[]) : Promise<{prepareInstructions : TransactionInstruction[], transactionIndex : bigint}>{
        let multisigAccount = await accounts.Multisig.fromAccountAddress(
            this.connection,
            this.multisigPda
        );

        const transactionIndex = utils.toBigInt(multisigAccount.transactionIndex) + 1n;

        const transferInstructions : TransactionInstruction[] = [];

        rewards.forEach((receiver) => {
            transferInstructions.push(
                SystemProgram.transfer({
                    fromPubkey: this.vaultPda,
                    toPubkey: new PublicKey(receiver.wallet),
                    lamports : Math.floor(receiver.sum * LAMPORTS_PER_SOL)
                })
            );
            console.log(`Sending ${receiver.sum * LAMPORTS_PER_SOL} to ${receiver.wallet}`);
        })

        const transactionMessage = new TransactionMessage({
            payerKey: this.vaultPda,
            instructions: transferInstructions,
            recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash
        });

        const vaultTransactionInstruction = instructions.vaultTransactionCreate({
            multisigPda : this.multisigPda,
            transactionIndex,
            creator: this.creator,
            vaultIndex: 0,
            ephemeralSigners: 1,
            transactionMessage: transactionMessage,
            memo: `Transfer lamports to each participant`
        });

        const vaultTransactionProposalInstruction = instructions.proposalCreate({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            creator: this.creator
        });

        const vaultTransactionProposalApproveInstruction =  instructions.proposalApprove({
            multisigPda: this.multisigPda,
            transactionIndex: transactionIndex,
            member: this.creator
        });

        const vaultPrepareInstructions : TransactionInstruction[] = [
            vaultTransactionInstruction,
            vaultTransactionProposalInstruction,
            vaultTransactionProposalApproveInstruction
        ];

        return {
            prepareInstructions: vaultPrepareInstructions,
            transactionIndex : transactionIndex
        }
    }

    async GetMultisigMembers() : Promise<types.Member[]> {
        const multisigAccount = await accounts.Multisig.fromAccountAddress(
            this.connection,
            this.multisigPda
        );
        return multisigAccount.members;
    }

    async ExecuteVaultTransaction(transactionIndex : bigint) : Promise<VersionedTransaction>{
        const vaultTransactionExecute = await transactions.vaultTransactionExecute({
            connection: this.connection,
            blockhash: (await this.connection.getLatestBlockhash()).blockhash,
            feePayer: this.creator,
            multisigPda: this.multisigPda,
            transactionIndex,
            member: this.creator
        });

        return vaultTransactionExecute;
    }

    GetMembersFromPublicKeys(memberPubs : PublicKey[], permission : types.Permission) : types.Member[] {
        let newMembers : types.Member[] = [];

        memberPubs.forEach((memPubs) => {
            newMembers.push({
                key: memPubs,
                permissions: types.Permissions.fromPermissions([permission]),
            })
        })
        return newMembers;
    }
}


