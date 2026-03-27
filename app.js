import {Button, Div, Form, Input, Span, Jsm, useState, useEffect, useMemo, useCallback} from './lib/jsm.js';

const TodoItem = Jsm((props) => {
  // Add internal click counter to demonstrate the bug
  const clickCount = useState(0);
  const {todo, onToggle, onRemove} = props || {todo: {text: 'default'}, onToggle: () => {}, onRemove: () => {}};

  useEffect(() => {
    console.log(`Todo "${todo.text}" is now ${todo.completed ? 'completed' : 'incomplete'}. Click count: ${clickCount.value}`);
  }, [todo.completed]);

  useEffect(() => {
    console.log(`Todo ${todo.text} created.`);
  }, [])

  useEffect(() => {
    return () => {
      console.log(`Todo "${todo.text}" is being removed. Final click count: ${clickCount.value}`);
    }
  }, [])
  
  return Div({
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px',
      marginBottom: '6px',
      borderRadius: '8px',
      border: '1px solid #ddd',
      backgroundColor: todo.completed ? '#e4ffe5' : '#ffffff',
      color: todo.completed ? '#4c994c' : '#333'
    }
  },
    Div({style: {display: 'flex', alignItems: 'center', gap: '8px'}},
      Input({
        type: 'checkbox',
        checked: todo.completed,
        onChange: () => onToggle(todo.id)
      }),
      Span({
        style: {
          textDecoration: todo.completed ? 'line-through' : 'none',
          flex: 1
        }
      }, `${todo.text} (clicked ${clickCount.value}x)`),
      Button({
        onClick: () => {
          clickCount.value++;
        },
        style: {backgroundColor: '#6c7ddb', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer'}
      }, 'Click')
    ),
    Button({
      onClick: () => onRemove(todo.id),
      style: {backgroundColor: '#ff5252', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer'}
    }, 'Remove')
  );
});

const App = Jsm(() => {
  const todos = useState([]);
  const newTodoText = useState('');
  const draftTodo = useState(null);
  const statusMessage = useState('Ready');
  const inputId = useMemo(() => `todo-input-${Date.now()}`, []);

  const allTodos = todos.value;

  useEffect(() => {
    statusMessage.value = `You have ${allTodos.length} todo${allTodos.length === 1 ? '' : 's'}`;
  }, [allTodos]);

  useEffect(() => {
    const inputNode = document.getElementById(inputId);
    if ( inputNode ) inputNode.focus();
  }, []);

  const activeTodos = useMemo(() => todos.value.filter(t => !t.completed), [todos]);
  const completedTodos = useMemo(() => todos.value.filter(t => t.completed), [todos]);

  const addTodo = useCallback(() => {
    const text = newTodoText.value.trim();
    if (!text) {
      statusMessage.value = 'Type something to add a todo.';
      return;
    }

    const nextTodo = {
      id: Date.now(),
      text,
      completed: draftTodo.value?.completed || false
    };

    todos.value = [nextTodo, ...todos.value];
    newTodoText.value = '';
    draftTodo.value = null;
    statusMessage.value = 'Todo added!';
  }, [todos, newTodoText, draftTodo, statusMessage]);

  const toggleTodo = useCallback((id) => {
    if ( id === 'draft' ) {
      draftTodo.value = {...draftTodo.value, completed: !draftTodo.value.completed};
      return;
    }
    todos.value = todos.value.map(todo =>
      todo.id === id ? {...todo, completed: !todo.completed} : todo
    );
  }, [todos, draftTodo]);

  const clearCompleted = useCallback(() => {
    if ( draftTodo.value?.completed ) {
      draftTodo.value = null;
    }
    todos.value = todos.value.filter(todo => !todo.completed);
    statusMessage.value = 'Completed todos cleared';
  }, [todos, newTodoText, statusMessage, draftTodo]);

  return Div({
    style: {
      fontFamily: 'Segoe UI, Arial, sans-serif',
      maxWidth: '700px',
      margin: '32px auto',
      padding: '24px',
      backgroundColor: '#fdfdfd',
      borderRadius: '14px',
      boxShadow: '0 12px 30px rgba(0,0,0,0.08)' 
    }
  },
    Div({style: {display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px'}},
      Div({style: {fontSize: '24px', fontWeight: '800'}}, '🗒️ Todo Showcase'),
      Span({style: {fontSize: '14px', color: '#666'}}, statusMessage.value)
    ),

    Form({
      onSubmit: (e) => {
        e.preventDefault();
        addTodo();
      },
      style: {display: 'flex', gap: '10px', marginBottom: '15px'}
    },
      Input({
        id: inputId,
        type: 'text',
        value: newTodoText.value,
        placeholder: 'Enter a new todo',
        onInput: (e) => {
          const value = e.target.value;
          newTodoText.value = value;

          const trimmed = value.trim();
          if (!trimmed) {
            draftTodo.value = null;
            return;
          }

          draftTodo.value = {
            id: 'draft',
            text: value,
            completed: false
          };
        },
        style: {flex: '1', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none'}
      }),
      Button({
        type: 'submit',
        style: {backgroundColor: '#4a90e2', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer'}
      }, 'Add')
    ),

    Div({style: {display: 'flex', gap: '10px', marginBottom: '14px'}},
      Button({
        onClick: () => {
          todos.value = todos.value.map(todo => ({...todo, completed: true}));
          statusMessage.value = 'All marked complete';
        },
        style: {flex: '1', padding: '10px', borderRadius: '8px', border: '1px solid #aaa', cursor: 'pointer'}
      }, 'Complete All'),
      Button({
        onClick: clearCompleted,
        style: {flex: '1', padding: '10px', borderRadius: '8px', border: '1px solid #ff8559', backgroundColor: '#ffece7', cursor: 'pointer'}
      }, `Clear Completed (${completedTodos.length})`)
    ),

    Div({style: {display: 'grid', gap: '8px'}},
      draftTodo.value && TodoItem({key: 'draft', todo: draftTodo.value, onToggle: toggleTodo, onRemove: () => draftTodo.value = null}),
      ...allTodos.map(todo =>
        TodoItem({key: todo.id, todo, onToggle: toggleTodo, onRemove: (id) => {
          todos.value = todos.value.filter(item => item.id !== id);
          statusMessage.value = 'Todo removed';
        }})
      )
    ),

    Div({style: {marginTop: '20px', color: '#333', fontSize: '14px'}},
      Span(`Active: ${activeTodos.length}`),
      Span({style: {marginLeft: '18px'}}, `Completed: ${completedTodos.length}`),
      Span({style: {marginLeft: '18px'}}, `Total: ${allTodos.length}`)
    )
  );
});

export default App;