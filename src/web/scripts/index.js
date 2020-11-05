import React, { useEffect, useState, useRef, Fragment } from 'react'
import { render } from 'react-dom'
import CommitGrid from '../../shared/components/commit-grid'
import InfoDrawer from '../../shared/components/info-drawer'
import SettingsDrawer from '../../shared/components/settings-drawer'
import Actions from '../../shared/components/actions'
import Progress from '../../shared/components/progress'
import Toasts from '../../shared/components/toasts'
import AudioToggle from '../../shared/components/audio-toggle'
import useSound from '../../shared/hooks/useSound'

import {
  MESSAGES,
  ACTIONS,
  SELECT_PLACEHOLDER,
  TOASTS,
} from '../../shared/constants'
import { downloadFile, generateShellScript } from './shell'
import CLICK_PATH from '../../shared/assets/audio/click.mp3'
import SPARKLE_PATH from '../../shared/assets/audio/sparkle.mp3'
import TRUMPET_PATH from '../../shared/assets/audio/trumpet-fanfare.mp3'
import BRUSH_PATH from '../../shared/assets/audio/brush-stroke.mp3'

import 'regenerator-runtime/runtime'
import '../styles/index.styl'
import '../../shared/styles/shared.styl'
import { usePersistentReducer, APP_REDUCER } from './reducer'

const ROOT_NODE = document.querySelector('#app')
const REPO_PATH = '.vincents-canvas'

const URL = '/.netlify/functions/vincent'
const App = () => {
  const [
    {
      cleared,
      username,
      repository,
      branch,
      muted,
      toast,
      images,
      generating,
      selected,
    },
    dispatch,
  ] = usePersistentReducer(APP_REDUCER, undefined, ['toast'])
  const [hideVincent, setHideVincent] = useState(false)
  const [dirty, setDirty] = useState(selected !== '')
  const nameInput = useRef(null)
  const errorRef = useRef(null)
  const { play: clickPlay } = useSound(CLICK_PATH)
  const { play: sparklePlay } = useSound(SPARKLE_PATH)
  const { play: brushPlay } = useSound(BRUSH_PATH)
  const { play: trumpetPlay } = useSound(TRUMPET_PATH)
  const NUMBER_OF_DAYS = 52 * 7 + (new Date().getDay() + 1)
  const cellsRef = useRef(
    selected
      ? JSON.parse(JSON.parse(selected).commits)
      : new Array(NUMBER_OF_DAYS).fill(0)
  )

  // Utility function to make sure days match the number of cells
  // for the current day.
  const sanitizeDays = (commitArray, cellAmount) => {
    let commits = [...commitArray]
    if (commits.length < cellAmount) {
      commits = [
        ...commits,
        ...new Array(cellAmount - commits.length).fill().map((c) => 0),
      ]
    }
    if (commits.length > cellAmount) {
      commits = commits.slice(0, cellAmount)
    }
    return commits
  }

  useEffect(() => {
    if (selected.trim() !== '' && nameInput.current)
      nameInput.current.value = JSON.parse(selected).name
  }, [selected])

  const onDelete = () => {
    if (!muted) clickPlay()
    const name = JSON.parse(selected).name
    if (window.confirm(MESSAGES.CONFIRM_DELETE(name))) {
      nameInput.current.value = ''
      dispatch({
        type: ACTIONS.DELETE,
        name,
      })
    }
  }

  const onSelect = (e) => {
    // This one is to keep the select in sync. Set selected in the dispatch
    // setImage(e.target.value)
    if (e.target.value === SELECT_PLACEHOLDER) {
      nameInput.current.value = ''
      return dispatch({
        type: ACTIONS.LOAD,
        selected: '',
      })
    }
    const { name, commits } = JSON.parse(e.target.value)
    // Update the input ref
    nameInput.current.value = name
    cellsRef.current = sanitizeDays(
      JSON.parse(commits),
      NUMBER_OF_DAYS
    ).map((value) => parseInt(value, 10))
    // Trick to re-render the commit grid without using state for cells
    setDirty(true)
    if (!muted) sparklePlay()
    dispatch({
      type: ACTIONS.LOAD,
      selected: e.target.value,
    })
  }

  const onGenerate = async () => {
    if (!muted) clickPlay()
    dispatch({
      type: ACTIONS.GENERATE,
    })
  }

  const onSave = () => {
    // Probably better here to grab the ref value??
    // And then set it via props if we can?
    if (!muted) clickPlay()
    dispatch({
      type: ACTIONS.SAVE,
      commits: cellsRef.current,
      name: nameInput.current.value,
    })
  }

  useEffect(() => {
    const getMultiplier = async () => {
      try {
        const resp = await fetch(
          `${URL}?username=${username}&repository=${repository}&branch=${branch}`
        )
        if (resp.status !== 200) {
          const ERROR = await resp.json()
          errorRef.current = ERROR.message
          dispatch({
            type: ACTIONS.TOASTING,
            toast: {
              type: TOASTS.ERROR,
              message: ERROR.message,
            },
          })
          setHideVincent(true)
        } else {
          setTimeout(async () => {
            const multiplier = await (await resp.json()).multiplier
            dispatch({
              type: ACTIONS.TOASTING,
              toast: {
                type: TOASTS.INFO,
                message: `Max commits ${multiplier}`,
              },
            })
            const SCRIPT = await generateShellScript(
              cellsRef.current,
              username,
              multiplier,
              repository,
              branch,
              REPO_PATH,
              dispatch
            )
            downloadFile(SCRIPT)
            setHideVincent(true)
          }, 5000)
        }
      } catch (err) {
        errorRef.current = err.message
        dispatch({
          type: ACTIONS.TOASTING,
          toast: {
            type: TOASTS.ERROR,
            message: err.message,
          },
        })
        setHideVincent(true)
      }
    }
    if (generating) {
      getMultiplier()
    } else {
      setHideVincent(false)
      if (errorRef.current) errorRef.current = null
    }
  }, [generating, branch, dispatch, repository, username])

  const onSettingsUpdate = (settings) => {
    if (!muted) clickPlay()
    dispatch({
      type: ACTIONS.SETTINGS,
      ...settings,
    })
  }

  const onProgressEnd = () => {
    dispatch({
      silent: errorRef.current,
      type: ACTIONS.GENERATE,
    })
    if (!errorRef.current) trumpetPlay()
  }

  const toggleAudio = () => {
    if (muted) clickPlay()
    dispatch({
      type: ACTIONS.AUDIO,
    })
  }
  const checkDirty = () => {
    setDirty(cellsRef.current.filter((cell) => cell !== 0).length > 0)
  }

  const onWipe = () => {
    if (!muted) clickPlay()
    if (window.confirm(MESSAGES.CONFIRM_WIPE)) {
      cellsRef.current = new Array(NUMBER_OF_DAYS).fill(0)
      nameInput.current.value = ''
      setDirty(false)
      if (!muted) brushPlay()
      dispatch({
        type: ACTIONS.WIPE,
      })
    }
  }
  const disabled =
    generating || !dirty || (dirty && !(username || repository || branch))

  return (
    <Fragment>
      <SettingsDrawer
        username={username}
        repository={repository}
        branch={branch}
        onSubmit={onSettingsUpdate}
      />
      <InfoDrawer />
      <div className="canvas">
        <CommitGrid
          key={cleared}
          muted={muted}
          cells={cellsRef.current}
          onChange={checkDirty}
        />
        <Actions
          images={images}
          selectedImage={selected}
          dirty={dirty}
          onSelect={onSelect}
          disabled={disabled}
          onDelete={onDelete}
          onGenerate={onGenerate}
          onWipe={onWipe}
          onSave={onSave}
          nameRef={nameInput}
        />
      </div>
      {generating && <Progress hide={hideVincent} onComplete={onProgressEnd} />}
      <AudioToggle onToggle={toggleAudio} />
      <Toasts toast={toast} />
    </Fragment>
  )
}

render(<App />, ROOT_NODE)