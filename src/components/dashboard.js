import $ from 'jquery'
import ArbitrationPrice from './arbitration-price'
import Archon from '@kleros/archon'
import DisputeList from './dispute-list'
import NavBar from './navbar.js'
import { RateLimiter } from 'limiter'
import React from 'react'
import { deployCentralizedArbitrator } from '../ethereum/centralized-arbitrator'
import web3 from '../ethereum/web3'

class Dashboard extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      arbitrationCost: '',
      contractAddresses: [],
      notifications: [],
      owner: '',
      selectedAddress: undefined,
      uglyFixtoBug13: '' // See https://github.com/kleros/centralized-arbitrator-dashboard/issues/13
    }
  }

  eventNotificationServiceRoute(address, eventName, networkName) {
    if (networkName === 'main')
      return `https://events.kleros.io/contracts/${address}/listeners/${eventName}/callbacks`
    else
      return `https://kovan-events.kleros.io/contracts/${address}/listeners/${eventName}/callbacks`
  }

  scanContracts(networkType, account) {
    const limiter = new RateLimiter(1, 250)
    const api = {
      kovan: 'api-kovan.',
      mainnet: 'api.'
    }
    console.log(networkType)
    const apiPrefix = networkType === 'main' ? api.mainnet : api.kovan

    fetch(
      `https://${apiPrefix}etherscan.io/api?module=account&action=txlist&address=${account}&apikey=YHYC1VSRWMQ3M5BF1TV1RRS3N7QZ8FQPEV`
    )
      .then(response => response.json())
      .then(data =>
        data.result
          .filter(({ to }) => to === '')
          .map(item => item.contractAddress)
      )
      .then(addresses =>
        addresses.map(address =>
          limiter.removeTokens(1, async () =>
            fetch(
              `https://${apiPrefix}etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=YHYC1VSRWMQ3M5BF1TV1RRS3N7QZ8FQPEV`
            )
              .then(response => response.json())
              .then(data => {
                if (data.result[0].ContractName === 'CentralizedArbitrator') {
                  this.setState(state => ({
                    contractAddresses: [...state.contractAddresses, address]
                  }))

                  // Call eventNotificationService here

                  if (!window.localStorage.getItem(account))
                    window.localStorage.setItem(account, address)
                  else
                    window.localStorage.setItem(
                      account,
                      window.localStorage
                        .getItem(account)
                        .concat(' ')
                        .concat(address)
                    )
                }
              })
          )
        )
      )
  }

  apiPrefix = networkType => {
    switch (networkType) {
      case 'main':
        return ' '
      case 'kovan':
        return 'kovan.'
      default:
        return ' '
    }
  }

  async componentDidMount() {
    this.setState({
      archon: new Archon(window.web3.currentProvider, 'https://ipfs.kleros.io')
    })

    $('*').on('click', () => {
      this.setState({ uglyFixtoBug13: '' })
    })
    const { contractAddresses } = this.state
    if (window.web3 && window.web3.currentProvider.isMetaMask)
      window.web3.eth.getAccounts((error, accounts) => {
        if (error) console.error(error)

        this.setState({ wallet: accounts[0] })

        console.warn('FETCH')
      })
    else console.log('MetaMask account not detected :(')

    this.setState({
      selectedAddress: contractAddresses[0]
    })

    window.ethereum.on('accountsChanged', accounts => {
      web3.eth.net.getNetworkType((error, networkType) => {
        if (error) console.error(error)
        console.log(accounts[0])
        this.setState({ networkType: networkType })
        if (accounts[0])
          if (window.localStorage.getItem(accounts[0]))
            this.setState({
              contractAddresses: window.localStorage
                .getItem(accounts[0])
                .split(' ')
            })
          else {
            this.setState({ contractAddresses: [] })
            this.scanContracts(networkType, accounts[0])
          }
      })
    })
  }

  deploy = (account, arbitrationPrice) => async e => {
    e.preventDefault()

    console.log('deploying')
    const result = await deployCentralizedArbitrator(
      account,
      web3.utils.toWei(arbitrationPrice, 'ether')
    )

    const item = window.localStorage.getItem(account) || ''

    console.log(item)
    window.localStorage.setItem(
      account,
      item.concat(' ').concat(result._address)
    )
    this.setState({
      contractAddresses: window.localStorage.getItem(account).split(' ')
    })
  }

  handleCentralizedArbitratorDropdownKeyEnter = () => e => {
    if (e.keyCode === 13) this.setState({ selectedAddress: e.target.value })
  }

  handleCentralizedArbitratorDropdownButtonClick = address => e => {
    this.setState({ selectedAddress: address })
  }

  centralizedArbitratorButtons = addresses =>
    addresses.map(address => (
      <div className="dropdown-item ">
        <button
          className="dropdown-item"
          key={address}
          onClick={this.handleCentralizedArbitratorDropdownButtonClick(address)}
        >
          <a
            href={`https://${this.apiPrefix(
              this.state.networkType
            )}etherscan.io/address/${address}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <img className="m-2" src="etherscan.svg" width="30" height="30" />
          </a>
          {address}
        </button>
      </div>
    ))

  handleArbitrationPriceChange = () => e => {
    console.log(e)
    this.setState({ arbitrationCost: e.target.value })
  }

  notificationCallback = (notification, time) => {
    this.setState(state => ({
      notifications: [...state.notifications, { notification, time }]
    }))
  }

  clearNotificationsCallback = () => {
    console.log('clearNotifications called')
    this.setState(() => ({
      notifications: []
    }))
  }

  render() {
    console.log(`RENDERING${new Date().getTime()}`)
    const {
      arbitrationCost,
      archon,
      contractAddresses,
      networkType,
      notifications,
      selectedAddress,
      wallet
    } = this.state

    if (!wallet)
      return (
        <div>Please unlock your MetaMask and refresh the page to continue.</div>
      )

    return (
      <div className="container-fluid">
        {wallet && (
          <div className="row">
            <div className="col">
              <NavBar
                clearNotifications={this.clearNotificationsCallback}
                networkType={networkType}
                notifications={notifications}
                wallet={wallet}
              />
            </div>
          </div>
        )}
        <div className="row">
          <div className="col text-center">
            <h4 className="text-center">
              Select A Deployed Centralized Arbitrator
            </h4>
            <div className="row">
              <div className="col">
                <div className="input-group mb-3">
                  <input
                    className="form-control"
                    disabled
                    placeholder="Please select a centralized arbitrator contract"
                    type="text"
                    value={selectedAddress}
                  />
                  <div className="input-group-append">
                    <button
                      aria-expanded="false"
                      aria-haspopup="true"
                      className="btn btn-secondary dropdown-toggle primary"
                      data-toggle="dropdown"
                      id="dropdownMenuButton"
                      type="button"
                    >
                      Select
                    </button>
                    <div
                      aria-labelledby="dropdownMenuButton"
                      className="dropdown-menu"
                    >
                      <h5 className="text-center my-3">Contract Addresses</h5>
                      <div class="dropdown-divider" />

                      {this.centralizedArbitratorButtons(contractAddresses)}
                      <div class="dropdown-divider" />
                      <input
                        className="dropdown-item"
                        onKeyUp={this.handleCentralizedArbitratorDropdownKeyEnter()}
                        placeholder="Or enter the address manually and hit enter"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col">
            <div className="col">
              <h4>Deploy A New Centralized Arbitrator</h4>
              <div className="row">
                <div className="col">
                  <div className="input-group mb-3">
                    <input
                      aria-describedby="basic-addon1"
                      aria-label=""
                      className="form-control"
                      onChange={this.handleArbitrationPriceChange()}
                      placeholder="Please enter desired arbitration price (ETH)"
                      type="text"
                      value={arbitrationCost}
                    />
                    <div className="input-group-append">
                      <button
                        className="btn btn-primary primary"
                        onClick={this.deploy(wallet, arbitrationCost)}
                        type="button"
                      >
                        Deploy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <hr className="secondary" />
        {selectedAddress && (
          <div>
            <div className="row">
              <div className="col-md-6 offset-md-3">
                <ArbitrationPrice
                  activeWallet={wallet}
                  contractAddress={selectedAddress}
                  web3={web3}
                />
              </div>
            </div>
            <div className="row">
              <div className="col">
                <div className="disputes">
                  {selectedAddress && wallet && (
                    <DisputeList
                      activeWallet={wallet}
                      archon={archon}
                      contractAddress={selectedAddress}
                      networkType={networkType}
                      notificationCallback={this.notificationCallback}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
}

export default Dashboard
