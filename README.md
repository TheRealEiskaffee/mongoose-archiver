[![npm version](https://img.shields.io/npm/v/better-mongoose-archiver.svg)](https://www.npmjs.com/package/better-mongoose-archiver)

# Mongoose Archiver Plugin

A Mongoose plugin that archives documents before deletion or updates. This plugin automatically saves a versioned history of modified or deleted documents to a separate collection.

## Features

- Archives documents before `update` or `delete` operations.
- Saves a versioned history of each document.
- Allows tracking of users who performed the operation.
- **Custom Update/Delete/Save Function**: Optionally, execute a custom function after each document update, delete, or save, giving you additional flexibility.

## Installation

Install the plugin with npm:

```bash
npm install mongoose-archiver
```

## Usage

To use the Mongoose Archiver plugin, import it and add it to your schema:

1. Import the plugin and the necessary Mongoose modules:

    ```javascript
    import mongooseArchiver from 'mongoose-archiver';
    import { Schema } from 'mongoose';
    ```

2. Define your schema and apply the plugin:

    ```javascript
    const yourSchema = new Schema({
        name: String,
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        // Add other fields as needed
    });

    // Apply the plugin, optionally specifying a `userField`, `separator` for the collection name like: "users_history" (default is -) and custom functions for `onUpdate`, `onDelete`, and `onSaveHistory`
    yourSchema.plugin(mongooseArchiver, {
        userField: 'updatedBy',
        separator: '_',
        onUpdate: async (historyDoc) => {
            console.log(`Document with ID ${historyDoc._id} was archived on update.`);
        },
        onDelete: async (historyDoc) => {
            console.log(`Document with ID ${historyDoc._id} was archived on delete.`);
        },
        onSaveHistory: async (historyDoc) => {
            console.log(`History document for ${historyDoc.origin} has been saved.`);
            
            // To modify a document in `onSaveHistory`, use `doc.set('myOwnProp', true)` instead of direct assignment
            historyDoc.set('myOwnProp', true);
        }
    });
    ```

3. Create a model and use it in your application:

    ```javascript
    const YourModel = mongoose.model('YourModel', yourSchema);

    // Example usage
    YourModel.updateOne({ name: 'Example' }, { name: 'Updated Example' }, { user : '5d762323246cd34367f6af8c' })
      .then(() => console.log('Document updated and archived!'))
      .catch(err => console.error(err));

    YourModel.deleteOne({ name: 'Example' }, { user : '5d762323246cd34367f6af8c' })
      .then(() => console.log('Document deleted and archived!'))
      .catch(err => console.error(err));
    ```

With the plugin applied, every `update`, `delete`, and `save` operation will create a corresponding history document in a separate collection (`yourModelName_history`). This document will retain the previous version and metadata about the update, deletion, or save operation. If you pass in the mongoose options the parameter `user`, it will register who `update` or `delete` the document.

## Options

- `userField` (optional): Specifies the field in the document to track the user who performed the update or delete action. By default, the plugin will attempt to use this field to store user information in the history record.
- `separator` (optional): Defines the separator for naming history collections (default: `'-'`).
- `onUpdate` (optional): A custom function that is executed after archiving a document on an update operation. This function receives the history document as a parameter and can perform additional actions if needed.
- `onDelete` (optional): A custom function that is executed after archiving a document on a delete operation. This function receives the history document as a parameter and can perform additional actions if needed.
- `onSaveHistory` (optional): A custom function that is executed when a history document is saved. This function receives the history document as a parameter and allows further manipulation or logging.

## How It Works

The plugin performs the following operations:

1. **On Update**: Before executing an update, it clones the document's current state and saves it as a history record in a separate collection.
2. **On Delete**: Before deleting a document, it saves the document’s state with `deleted.at` and `deleted.by` fields in a history collection.
3. **On Save**: When a history document is created, the `onSaveHistory` function (if provided) will be executed.

Each history document includes:
- `origin`: A reference to the original document.
- `version`: The version number for tracking document changes.
- `archived`: Contains the date and user who archived the document.
- `deleted`: Contains the date and user who deleted the document (only for delete operations).

## Code Overview

### Core Code

This plugin uses the following methods:

- **Update Methods**: `findOneAndUpdate`, `updateMany`, `updateOne`, `save`
- **Delete Methods**: `deleteOne`, `deleteMany`, `findOneAndDelete`

The plugin sets up `pre` hooks for each method, creating a clone of the document in a history collection (`yourModelName_history`) whenever an update, delete, or save operation is performed.

## License

MIT