# AI construction companion

## Main Overview:
We need two applications connected to one backend.
The two applications are the following:
  - We need an mobile application (preferebly swift as we have experience in xcode) for the person demanding a product.
  - We also need a react/next.js web app for procurement.

  ### Mobile App
  
  Upon three big buttons should appear: camera, microphone, text
  
  That way a user can select which option suits him based based on whether he has the product already avaiable, has gloves on or is in a loud environment.
  
  #### Image:
  
  The AI should decide based on some preset categories, which category the image responds to. It will then show a list of items in that category sorted by popularity.
  
  #### Voice:
  
  The AI should process what the person said and then show the item directly or items that are in that very specific category. Also sorted by popularity.
  
  #### Text:
  
  The AI should process what the person typed and then show the item directly or items that are in that very specific category. Also sorted by popularity.

  Once the items are shown in a big manner with large buttons, the worker can select the item needed and the press order.
  Depending on the price of the item, he will get the option to request approval instead of ordering directly. (Whether he gets to order himself also depends on the hierarchy. This will be explained later on.)
  
  Approval request will be sent to the app of the approver and he will be able to approve. There he will get context on who is requesting what.
  
  If he doesn't approve the requestor will get a notification that it wasn't approved.
  
  If he does however approve or doesn't need approval in the first place, he will receive confirmation that the order is pending. The backend will then create the PO and send it to the supplier. AI will then read the response from the supplier and once he accepts the PO, confirmation will be sent to requestor stating that order has been executed.

### Web App for Procurement

Still to be decided...

They will get an overview with cards of the spending of all the different sites. They can click on these cards, and will then get a detailed overview of the spending in different categories. They will also get a history of recent purchases with information regarding what was bought, site, requestor, approver.

They also get an overview of all employees on that very site and get to choose their budget.

T.b.d: There should also be a Place where they can upload excels, csvs and other data. So that it creates a unified database for all avaible products from contracts, product lists etc. The tables of that database are still to be decided.


### Backend


