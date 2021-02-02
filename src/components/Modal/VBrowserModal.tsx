import React from 'react';
import { Modal, Button, Table } from 'semantic-ui-react';
import {
  GoogleReCaptchaProvider,
  withGoogleReCaptcha,
} from 'react-google-recaptcha-v3';
import { SignInButton } from '../TopBar/TopBar';

export class VBrowserModal extends React.Component<{
  closeModal: Function;
  startVBrowser: Function;
  isSubscriber: Boolean;
  subscribeButton: JSX.Element;
  user?: firebase.User;
}> {
  render() {
    const { closeModal, startVBrowser } = this.props;
    const LaunchButton = withGoogleReCaptcha(
      ({ googleReCaptchaProps, large }: any) => (
        <Button
          size="large"
          color={large ? 'orange' : undefined}
          onClick={async () => {
            const rcToken = await (googleReCaptchaProps as any).executeRecaptcha(
              'launchVBrowser'
            );
            startVBrowser(rcToken, { size: large ? 'large' : '' });
            closeModal();
          }}
        >
          {large ? 'Launch VBrowser+' : 'Continue with Free'}
        </Button>
      )
    );
    return (
      <GoogleReCaptchaProvider
        reCaptchaKey={process.env.REACT_APP_RECAPTCHA_SITE_KEY as string}
        useRecaptchaNet
      >
        <Modal open={true} onClose={closeModal as any}>
          <Modal.Header>Launch a VBrowser</Modal.Header>
          <Modal.Content image>
            <Modal.Description>
              <div>
                You're about to launch a virtual browser to share in this room.
              </div>
              <Table definition unstackable striped>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell />
                    <Table.HeaderCell>WatchParty Free</Table.HeaderCell>
                    <Table.HeaderCell>WatchParty Plus</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  <Table.Row>
                    <Table.Cell>VBrowser Resolution</Table.Cell>
                    <Table.Cell>720p</Table.Cell>
                    <Table.Cell>1080p</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell>VBrowser CPU/RAM</Table.Cell>
                    <Table.Cell>Standard</Table.Cell>
                    <Table.Cell>Extra</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell>VBrowser Session Length</Table.Cell>
                    <Table.Cell>3 hours</Table.Cell>
                    <Table.Cell>12 hours</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell></Table.Cell>
                    <Table.Cell>
                      {this.props.user ? (
                        <LaunchButton />
                      ) : (
                        <SignInButton fluid user={this.props.user} />
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {this.props.isSubscriber ? (
                        <LaunchButton large />
                      ) : (
                        this.props.subscribeButton
                      )}
                    </Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table>
            </Modal.Description>
          </Modal.Content>
        </Modal>
      </GoogleReCaptchaProvider>
    );
  }
}
