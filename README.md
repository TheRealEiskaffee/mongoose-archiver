[![npm version](https://img.shields.io/npm/v/better-mongoose-archiver.svg)](https://www.npmjs.com/package/better-mongoose-archiver)

# Mongoose Archiver Plugin

A Mongoose plugin that archives documents before deletion or updates. This plugin automatically saves a versioned history of modified or deleted documents to a separate collection.

## Features

- Archives documents before `update` or `delete` operations.
- Saves a versioned history of each document.
- Allows tracking of users who performed the operation.
- **Custom Update/Delete Function**: Optionally, execute a custom function after each document update/delete, giving you additional flexibility.

## Installation

Install the plugin with npm:

```bash
npm install mongoose-archiver
```

## Usage

To use the Mongoose Archiver plugin, import it and add it to your schema:

1. Import the plugin and the necessary Mongoose modules:

    ```typescript
    import mongooseArchiver from 'better-mongoose-archiver';
    import { Schema } from 'mongoose';
    ```

2. Define your schema and apply the plugin:

    ```typescript
    const yourSchema = new Schema({
        name: String,
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        // Add other fields as needed
    });

    // Apply the plugin, optionally specifying a `userField` and a custom `onUpdate` function
    yourSchema.plugin(mongooseArchiver, { 
        userField: 'updatedBy',
        onUpdate: async (doc) => {
            console.log(`Document with ID ${doc._id} was archived.`);
        },
        onDelete: async (doc) => {
            console.log(`Document with ID ${doc._id} was deleted.`);
        }
    });
    ```

3. Create a model and use it in your application:

    ```typescript
    const YourModel = mongoose.model('YourModel', yourSchema);

    // Example usage
    YourModel.updateOne({ name: 'Example' }, { name: 'Updated Example' })
      .then(() => console.log('Document updated and archived!'))
      .catch(err => console.error(err));

    YourModel.deleteOne({ name: 'Example' })
      .then(() => console.log('Document deleted and archived!'))
      .catch(err => console.error(err));
    ```

With the plugin applied, every `update` and `delete` operation will create a corresponding history document in a separate collection (`yourModelName_histories`). This document will retain the previous version and metadata about the update or deletion.

## Options

- `userField` (optional): Specifies the field in the document to track the user who performed the update or delete action. By default, the plugin will attempt to use this field to store user information in the history record.
- `onUpdate` (optional): A custom function that is executed after archiving a document on an update operation. This function receives the document being updated as a parameter and can perform additional actions if needed.
- `onUpdate` (optional): A custom function that is executed after deleting a document on an delete operation. This function receives the document being updated as a parameter and can perform additional actions if needed.

## How It Works

The plugin performs the following operations:

1. **On Update**: Before executing an update, it clones the document's current state and saves it as a history record in a separate collection.
2. **On Delete**: Before deleting a document, it saves the document’s state with `deleted.at` and `deleted.by` fields in a history collection.

Each history document includes:
- `origin`: A reference to the original document.
- `version`: The version number for tracking document changes.
- `archived`: Contains the date and user who archived the document.
- `deleted`: Contains the date and user who deleted the document (only for delete operations).

## Code Overview

### Core Code

This plugin uses the following methods:

- **Update Methods**: `findOneAndUpdate`, `updateMany`, `updateOne`
- **Delete Methods**: `deleteOne`, `deleteMany`, `findOneAndDelete`

The plugin sets up `pre` hooks for each method, creating a clone of the document in a history collection (`yourModelName>_histories`) whenever an update or delete operation is performed.

### Types

#### `IOptions` Interface

```typescript
interface IOptions {
    userField?: string;
    onUpdate?: (doc: any) => Promise<void> | void; // Custom function executed after update
}
```

Defines the optional settings for the plugin, allowing you to specify a field to track the user who performs the operation, and a custom `onUpdate` function to execute after each update.

#### `TMethod` Type

```typescript
type TMethod = 'aggregate' | 'bulkWrite' | 'count' | 'countDocuments' | 'createCollection' | 'deleteOne' | 'deleteMany' | 'estimatedDocumentCount' | 'find' | 'findOne' | 'findOneAndDelete' | 'findOneAndReplace' | 'findOneAndUpdate' | 'init' | 'insertMany' | 'replaceOne' | 'save' | 'update' | 'updateOne' | 'updateMany' | 'validate';
```

Enumerates possible Mongoose methods that can be intercepted for archiving.

## License

MIT
